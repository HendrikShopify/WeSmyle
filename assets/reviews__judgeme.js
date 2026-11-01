/**
 * Judge.me adapter for the product reviews module.
 *
 * The only file that knows Judge.me exists. It turns neutral UI state into
 * Judge.me request URLs and maps Judge.me responses into our own data format.
 * To support another review app, write a new adapter with the same interface:
 *   capabilities, buildUrl(config, state), parse(json), load(config, state, options),
 *   submitReview(config, data, options), voteReview(reviewId, direction, options), openForm()
 *
 * voteReview: direction is 'up' or 'down'. options: { signal }.
 * Resolves { ok: true } on 2xx. Rejects with an Error otherwise.
 *
 * submitReview data (neutral names only):
 *   { rating, title, body, name, email, nameFormat, answers: { [questionId]: value }, files: [File] }
 * nameFormat: 'full' | 'last_initial' | 'all_initials' | 'anonymous'
 * options: { onProgress({ uploaded, total }), signal }
 * Resolves { ok: true }. Rejects with an Error whose message is user-readable.
 * error.details is the raw response. Photo failures also set error.fileName.
 *
 * Data format returned by parse():
 *   {
 *     summary:   { average, count, histogram: [{ rating, count }] },
 *     questions: [{ id, key, label, type, options: [value] }],
 *     reviews:   [{ id, rating, title, bodyHtml, author, isAnonymous, verified, date,
 *                   answers: [{ key, label, value }], photos: [{ thumb, full }],
 *                   videos: [{ id, thumb, src }], reply: { author, bodyHtml } | null,
 *                   country, countryCode, helpfulCount, unhelpfulCount }],
 *     page:      { page, totalPages, perPage }
 *   }
 */

(function (root) {
    'use strict';

    var ENDPOINT = 'https://cdn.judge.me/reviews/reviews_for_widget';
    var PRESIGN_ENDPOINT = 'https://api.judge.me/api/v1/pictures/presigned_data';
    var SUBMIT_ENDPOINT = 'https://api.judge.me/api/v1/reviews';
    var THUMBS_ENDPOINT = 'https://api.judge.me/thumbs';
    var MAX_PER_PAGE = 30; // Judge.me caps per_page at 30
    var GENERIC_SUBMIT_ERROR = 'Could not submit your review.';
    var GENERIC_UPLOAD_ERROR = 'Could not start the photo upload.';

    // Neutral sort names -> Judge.me parameters (all confirmed on a live store)
    var SORTS = {
        newest: { sort_by: 'created_at', sort_dir: 'desc' },
        highest: { sort_by: 'rating', sort_dir: 'desc' },
        lowest: { sort_by: 'rating', sort_dir: 'asc' },
        helpful: { sort_by: 'most_helpful' },
        photos_first: { sort_by: 'pictures_first' },
        videos_first: { sort_by: 'videos_first' },
    };

    var capabilities = {
        sorts: Object.keys(SORTS),
        defaultSort: 'newest',
        filters: {
            rating: true,   // filter_rating
            answers: true,  // cf_answer[] pairs
            search: true,   // search
            media: false,   // Judge.me only offers media as a sort (photos_first / videos_first)
        },
        maxPerPage: MAX_PER_PAGE,
        form: {
            photos: true,
            videos: false,
            maxPhotoSize: 10485760,
            maxPhotos: 5,
        },
        voting: {
            up: true,
            down: true,
            undo: false,
        },
    };

    // Neutral name formats -> Judge.me reviewer_name_format. "full" is an empty string.
    var NAME_FORMATS = {
        full: '',
        last_initial: 'last_initial',
        all_initials: 'all_initials',
        anonymous: 'anonymous',
    };

    function slugify(text) {
        return String(text || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    /**
     * config: { shopDomain, productId, perPage }
     * state:  { sort, rating, answers: { [questionId]: value }, search, page }
     */
    function buildUrl(config, state) {
        state = state || {};
        if (!config || !config.shopDomain || !config.productId) {
            throw new Error('Judge.me adapter: config.shopDomain and config.productId are required');
        }

        var params = new URLSearchParams();
        params.append('shop_domain', config.shopDomain);
        params.append('platform', 'shopify');
        params.append('product_id', String(config.productId));
        params.append('page', String(state.page || 1));
        params.append('per_page', String(Math.min(config.perPage || 10, MAX_PER_PAGE)));

        var sort = SORTS[state.sort] || SORTS[capabilities.defaultSort];
        Object.keys(sort).forEach(function (key) {
            params.append(key, sort[key]);
        });

        if (state.rating) params.append('filter_rating', String(state.rating));

        if (state.search && String(state.search).trim()) {
            params.append('search', String(state.search).trim());
        }

        // Custom question filters are sent as flat pairs: cf_answer[]=<id>&cf_answer[]=<value>
        var answers = state.answers || {};
        Object.keys(answers).forEach(function (questionId) {
            var value = answers[questionId];
            if (value === undefined || value === null || value === '') return;
            params.append('cf_answer[]', String(questionId));
            params.append('cf_answer[]', String(value));
        });

        return ENDPOINT + '?' + params.toString();
    }

    function isBunnyVideoId(id) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
    }

    // UUID ids are Bunny videos hosted on Judge.me's pull zone.
    function videoThumb(id) {
        if (!isBunnyVideoId(id)) return '';
        return 'https://review-videos.judgeme.com/' + id + '/thumbnail.jpg';
    }

    function videoSrc(id) {
        if (!isBunnyVideoId(id)) return '';
        return 'https://review-videos.judgeme.com/' + id + '/play_720p.mp4';
    }

    function parseReview(r) {
        return {
            id: r.uuid,
            rating: r.rating,
            title: r.title || '',
            bodyHtml: r.body_html || '',
            author: r.reviewer_name || '',
            isAnonymous: !!r.is_anonymous_reviewer,
            verified: !!r.verified_buyer,
            date: r.created_at,
            answers: (r.cf_answers || []).map(function (a) {
                return { key: slugify(a.question_title), label: a.question_title, value: String(a.value) };
            }),
            photos: (r.pictures_urls || []).map(function (p) {
                return { thumb: p.small || p.compact || p.original, full: p.huge || p.original };
            }),
            videos: (r.video_external_ids || []).map(function (id) {
                return { id: id, thumb: videoThumb(id), src: videoSrc(id) };
            }),
            reply: r.reply_content
                ? { author: r.shop_reply_name || '', bodyHtml: r.reply_content }
                : null,
            country: r.location_country || '',
            countryCode: r.location_country_code || '',
            helpfulCount: r.thumb_up || 0,
            unhelpfulCount: r.thumb_down || 0,
        };
    }

    function parse(json) {
        if (!json || typeof json !== 'object' || !Array.isArray(json.reviews)) {
            throw new Error(
                'Judge.me adapter: unexpected response. The store is probably on the legacy widget, ' +
                'which returns HTML. Upgrade to the new Review Widget in Judge.me.'
            );
        }

        var cfData = json.custom_form_filters_and_averages || {};
        var pagination = json.pagination || {};

        return {
            summary: {
                average: parseFloat(json.average_rating) || 0,
                count: json.number_of_reviews || 0,
                histogram: (json.histogram || []).map(function (h) {
                    return { rating: h.rating, count: h.frequency };
                }),
            },
            questions: (cfData.choice_cfs || []).map(function (q) {
                return {
                    id: q.id,
                    key: slugify(q.title),
                    label: q.title,
                    type: q.question_type,
                    options: (q.cf_options || []).slice(),
                };
            }),
            reviews: json.reviews.map(parseReview),
            page: {
                page: pagination.current_page || 1,
                totalPages: pagination.total_pages || 1,
                perPage: pagination.per_page || null,
            },
        };
    }

    /** Fetch + parse in one call. options: { signal } (AbortController signal) */
    function load(config, state, options) {
        var url = buildUrl(config, state);
        return fetch(url, { signal: options && options.signal })
            .then(function (res) {
                if (!res.ok) throw new Error('Judge.me adapter: request failed (' + res.status + ')');
                return res.text();
            })
            .then(function (text) {
                var json;
                try {
                    json = JSON.parse(text);
                } catch (e) {
                    return parse(null); // throws the legacy-widget error
                }
                return parse(json);
            });
    }

    function createError(message, details) {
        var error = new Error(message);
        error.details = details;
        return error;
    }

    function isAbortError(error) {
        return !!(error && error.name === 'AbortError');
    }

    function parseJson(text) {
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    function readableError(body, fallback) {
        if (body == null || body === '') return fallback;
        if (typeof body === 'string') {
            var trimmed = body.trim();
            if (!trimmed || trimmed.charAt(0) === '<' || trimmed.length > 300) return fallback;
            return trimmed;
        }
        if (typeof body !== 'object') return fallback;
        if (typeof body.error === 'string' && body.error.trim()) return body.error.trim();
        if (typeof body.message === 'string' && body.message.trim()) return body.message.trim();
        if (Array.isArray(body.errors)) {
            var items = body.errors.map(function (item) {
                return typeof item === 'string' ? item : '';
            }).filter(Boolean);
            if (items.length) return items.join(' ');
        }
        if (body.errors && typeof body.errors === 'object') {
            var parts = [];
            Object.keys(body.errors).forEach(function (key) {
                var value = body.errors[key];
                var text = Array.isArray(value) ? value.filter(function (item) {
                    return typeof item === 'string';
                }).join(', ') : (typeof value === 'string' ? value : '');
                if (text) parts.push(key + ': ' + text);
            });
            if (parts.length) return parts.join(' ');
        }
        return fallback;
    }

    function xmlTag(xml, tag) {
        if (!xml) return '';
        if (typeof DOMParser !== 'undefined') {
            var doc = new DOMParser().parseFromString(xml, 'application/xml');
            var failed = doc.querySelector && doc.querySelector('parsererror');
            if (!failed) {
                var node = doc.getElementsByTagName(tag)[0];
                if (!node && doc.getElementsByTagNameNS) node = doc.getElementsByTagNameNS('*', tag)[0];
                if (node && node.textContent) return node.textContent.trim();
            }
        }
        var match = new RegExp('<' + tag + '>([^<]*)</' + tag + '>').exec(xml);
        return match ? match[1].trim() : '';
    }

    function sanitizeFileName(name) {
        var cleaned = String(name || '')
            .replace(/\s+/g, '')
            .replace(/[^A-Za-z0-9.\-_]/g, '');
        return cleaned || 'photo';
    }

    function randomSuffix() {
        var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        var suffix = '';
        for (var i = 0; i < 5; i += 1) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return suffix;
    }

    function fileList(files) {
        var list = [];
        if (!files || !files.length) return list;
        for (var i = 0; i < files.length; i += 1) {
            if (files[i]) list.push(files[i]);
        }
        return list;
    }

    function photoError(file, message, details) {
        var error = createError(message || ('Could not upload "' + file.name + '".'), details);
        error.fileName = file.name;
        return error;
    }

    function getUploadTicket(config, signal) {
        var params = new URLSearchParams();
        params.append('url', config.shopDomain);
        params.append('shop_domain', config.shopDomain);
        params.append('platform', 'shopify');

        return fetch(PRESIGN_ENDPOINT + '?' + params.toString(), { signal: signal })
            .then(function (res) {
                return res.text().then(function (text) {
                    var json = parseJson(text);
                    if (!res.ok) {
                        console.error('Judge.me adapter: presigned data failed', json || text);
                        throw createError(readableError(json || text, GENERIC_UPLOAD_ERROR), json || text);
                    }
                    if (!json || !json.url || !json.key_prefix || !json.fields) {
                        console.error('Judge.me adapter: unexpected presigned data', text);
                        throw createError(GENERIC_UPLOAD_ERROR, text);
                    }
                    return json;
                });
            })
            .catch(function (error) {
                if (isAbortError(error) || (error && error.details !== undefined)) throw error;
                console.error('Judge.me adapter: presigned data failed', error);
                throw createError(GENERIC_UPLOAD_ERROR, error);
            });
    }

    function uploadPhoto(ticket, file, signal) {
        var key = ticket.key_prefix + randomSuffix() + '__' + sanitizeFileName(file.name);
        var form = new FormData();
        Object.keys(ticket.fields).forEach(function (name) {
            form.append(name, ticket.fields[name]);
        });
        form.append('key', key);
        form.append('file', file);

        return fetch(ticket.url, { method: 'POST', body: form, signal: signal })
            .then(function (res) {
                return res.text().then(function (text) {
                    if (res.status !== 201) {
                        var s3Message = xmlTag(text, 'Message');
                        var message = 'Could not upload "' + file.name + '".';
                        if (s3Message) message += ' ' + s3Message;
                        console.error('Judge.me adapter: photo upload failed', file.name, res.status, text);
                        throw photoError(file, message, text);
                    }
                    var uploadedKey = xmlTag(text, 'Key');
                    if (!uploadedKey) {
                        console.error('Judge.me adapter: photo upload missing key', file.name, text);
                        throw photoError(file, 'Could not upload "' + file.name + '".', text);
                    }
                    return uploadedKey;
                });
            })
            .catch(function (error) {
                if (isAbortError(error) || (error && error.fileName)) throw error;
                console.error('Judge.me adapter: photo upload failed', file.name, error);
                throw photoError(file, 'Could not upload "' + file.name + '".', error);
            });
    }

    function uploadPhotos(config, files, onProgress, signal) {
        return getUploadTicket(config, signal).then(function (ticket) {
            var uploaded = 0;
            return Promise.all(files.map(function (file) {
                return uploadPhoto(ticket, file, signal).then(function (key) {
                    uploaded += 1;
                    if (typeof onProgress === 'function') {
                        onProgress({ uploaded: uploaded, total: files.length });
                    }
                    return key;
                });
            }));
        });
    }

    function buildReviewBody(config, data, pictureKeys) {
        var params = new URLSearchParams();
        params.append('url', config.shopDomain);
        params.append('shop_domain', config.shopDomain);
        params.append('platform', 'shopify');
        params.append('id', String(config.productId));
        params.append('rating', String(data.rating));
        params.append('name', data.name == null ? '' : String(data.name));
        params.append('email', data.email == null ? '' : String(data.email));
        if (data.title && String(data.title).trim()) params.append('title', String(data.title));
        params.append('body', data.body == null ? '' : String(data.body));

        var format = Object.prototype.hasOwnProperty.call(NAME_FORMATS, data.nameFormat)
            ? NAME_FORMATS[data.nameFormat]
            : '';
        params.append('reviewer_name_format', format);

        (pictureKeys || []).forEach(function (key, index) {
            params.append('picture_keys[' + index + ']', key);
        });

        var answers = data.answers || {};
        Object.keys(answers).forEach(function (questionId) {
            var value = answers[questionId];
            if (value === undefined || value === null || value === '') return;
            params.append('cf_answers[' + questionId + '][cf_question_id]', String(questionId));
            params.append('cf_answers[' + questionId + '][value]', String(value));
        });

        return params;
    }

    function postReview(config, data, pictureKeys, signal) {
        return fetch(SUBMIT_ENDPOINT, {
            method: 'POST',
            body: buildReviewBody(config, data, pictureKeys),
            signal: signal,
        }).then(function (res) {
            return res.text().then(function (text) {
                var parsed = parseJson(text);
                var details = parsed == null ? text : parsed;
                if (!res.ok) {
                    console.error('Judge.me adapter: review submit failed', details);
                    throw createError(readableError(details, GENERIC_SUBMIT_ERROR), details);
                }
                return { ok: true };
            });
        }).catch(function (error) {
            if (isAbortError(error) || (error && error.details !== undefined)) throw error;
            console.error('Judge.me adapter: review submit failed', error);
            throw createError(GENERIC_SUBMIT_ERROR, error);
        });
    }

    /**
     * Submit a review. Uploads photos first when data.files is non-empty.
     * One presigned ticket is reused for every photo in the submission.
     * options: { onProgress, signal }
     */
    function submitReview(config, data, options) {
        options = options || {};
        data = data || {};
        if (!config || !config.shopDomain || !config.productId) {
            return Promise.reject(createError(GENERIC_SUBMIT_ERROR, null));
        }

        var files = fileList(data.files);
        var uploads = files.length
            ? uploadPhotos(config, files, options.onProgress, options.signal)
            : Promise.resolve([]);

        return uploads.then(function (keys) {
            return postReview(config, data, keys, options.signal);
        });
    }

    /**
     * Vote a review helpful or not. direction: 'up' | 'down'. options: { signal }.
     * Body is form-encoded so the request stays a simple CORS POST.
     * Resolves { ok: true } on 2xx. Rejects with an Error otherwise.
     */
    function voteReview(reviewId, direction, options) {
        options = options || {};
        if (direction !== 'up' && direction !== 'down') {
            return Promise.reject(new Error('Judge.me adapter: direction must be "up" or "down"'));
        }
        if (!reviewId) {
            return Promise.reject(new Error('Judge.me adapter: reviewId is required'));
        }

        var params = new URLSearchParams();
        params.append('review_uuid', String(reviewId));
        params.append('thumb_type', direction);

        return fetch(THUMBS_ENDPOINT, {
            method: 'POST',
            body: params,
            signal: options.signal,
        }).then(function (res) {
            if (!res.ok) throw new Error('Judge.me adapter: vote failed (' + res.status + ')');
            return { ok: true };
        });
    }

    /**
     * Opens Judge.me's own review form. Fallback only: the UI submits through submitReview.
     * Untested: depends on Judge.me's widget script being on the page.
     * Returns true if a form trigger was found.
     */
    function openForm() {
        var trigger = document.querySelector(
            '.jdgm-write-rev-link, [data-jdgm-write-review], .jdgm-rev-widg__header button'
        );
        if (trigger) {
            trigger.click();
            return true;
        }
        return false;
    }

    var adapter = {
        name: 'judgeme',
        capabilities: capabilities,
        buildUrl: buildUrl,
        parse: parse,
        load: load,
        submitReview: submitReview,
        voteReview: voteReview,
        openForm: openForm,
    };

    root.ReviewsAdapters = root.ReviewsAdapters || {};
    root.ReviewsAdapters.judgeme = adapter;
    if (typeof module !== 'undefined' && module.exports) module.exports = adapter;
})(typeof window !== 'undefined' ? window : globalThis);