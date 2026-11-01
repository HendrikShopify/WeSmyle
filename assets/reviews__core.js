/**
 * Reviews core. Owns filter state, response cache, and in-flight cancellation.
 * Talks to an adapter only through load(config, state, { signal }).
 * recordVote(reviewId, direction) adds 1 to that review's count in every cached page.
 *
 * Snapshot:
 *   { status, append, state, data, error, fromCache }
 * status: 'idle' | 'loading' | 'ready' | 'error'
 * append: true when this result should be added to the list (load more)
 * data: one page of normalized adapter data, or null
 */
(function (root) {
    'use strict';

    function cloneState(state) {
        return {
            sort: state.sort,
            rating: state.rating,
            answers: Object.assign({}, state.answers),
            search: state.search,
            page: state.page,
        };
    }

    function cacheKey(config, state) {
        var answers = state.answers || {};
        var normalizedAnswers = {};
        Object.keys(answers).sort().forEach(function (key) {
            normalizedAnswers[key] = answers[key];
        });

        return JSON.stringify({
            shopDomain: config.shopDomain,
            productId: String(config.productId),
            perPage: config.perPage,
            sort: state.sort,
            rating: state.rating || null,
            answers: normalizedAnswers,
            search: state.search || '',
            page: state.page || 1,
        });
    }

    function isAbortError(error) {
        return !!(error && error.name === 'AbortError');
    }

    function create(options) {
        var adapter = options && options.adapter;
        var config = options && options.config;
        if (!adapter || typeof adapter.load !== 'function') {
            throw new Error('Reviews core: adapter.load is required');
        }
        if (!config || !config.shopDomain || !config.productId) {
            throw new Error('Reviews core: config.shopDomain and config.productId are required');
        }

        var cache = new Map();
        var listeners = [];
        var controller = null;
        var requestId = 0;
        var state = {
            sort: (adapter.capabilities && adapter.capabilities.defaultSort) || 'newest',
            rating: null,
            answers: {},
            search: '',
            page: 1,
        };
        var snapshot = {
            status: 'idle',
            append: false,
            state: cloneState(state),
            data: null,
            error: null,
            fromCache: false,
        };

        function emit() {
            listeners.slice().forEach(function (listener) {
                listener(snapshot);
            });
        }

        function publish(next) {
            snapshot = next;
            emit();
            return snapshot;
        }

        function fetchState(nextState, append) {
            var key = cacheKey(config, nextState);
            var cached = cache.get(key);

            state = cloneState(nextState);

            if (controller) {
                controller.abort();
                controller = null;
            }

            if (cached) {
                return Promise.resolve(publish({
                    status: 'ready',
                    append: !!append,
                    state: cloneState(state),
                    data: cached,
                    error: null,
                    fromCache: true,
                }));
            }

            var id = ++requestId;
            var previousData = snapshot.data;
            controller = typeof AbortController === 'function' ? new AbortController() : null;

            publish({
                status: 'loading',
                append: !!append,
                state: cloneState(state),
                data: previousData,
                error: null,
                fromCache: false,
            });

            return adapter.load(config, cloneState(state), {
                signal: controller && controller.signal,
            }).then(function (data) {
                if (id !== requestId) return snapshot;
                cache.set(key, data);
                controller = null;
                return publish({
                    status: 'ready',
                    append: !!append,
                    state: cloneState(state),
                    data: data,
                    error: null,
                    fromCache: false,
                });
            }).catch(function (error) {
                if (isAbortError(error) || id !== requestId) return snapshot;
                controller = null;
                console.error(error && error.message ? error.message : error);
                return publish({
                    status: 'error',
                    append: false,
                    state: cloneState(state),
                    data: previousData,
                    error: error,
                    fromCache: false,
                });
            });
        }

        function replace(partial) {
            var next = cloneState(state);
            if (partial.sort !== undefined) next.sort = partial.sort;
            if (partial.rating !== undefined) next.rating = partial.rating || null;
            if (partial.answers !== undefined) next.answers = partial.answers || {};
            if (partial.search !== undefined) next.search = partial.search || '';
            next.page = 1;
            return fetchState(next, false);
        }

        return {
            getSnapshot: function () {
                return snapshot;
            },
            subscribe: function (listener) {
                listeners.push(listener);
                return function () {
                    listeners = listeners.filter(function (item) {
                        return item !== listener;
                    });
                };
            },
            load: function () {
                return fetchState(state, false);
            },
            setSort: function (sort) {
                return replace({ sort: sort });
            },
            setRating: function (rating) {
                return replace({ rating: rating });
            },
            setAnswer: function (questionId, value) {
                var answers = Object.assign({}, state.answers);
                if (value === undefined || value === null || value === '') delete answers[questionId];
                else answers[questionId] = value;
                return replace({ answers: answers });
            },
            setSearch: function (search) {
                return replace({ search: search });
            },
            loadMore: function () {
                var next = cloneState(state);
                next.page = (state.page || 1) + 1;
                return fetchState(next, true);
            },
            setPage: function (page) {
                var next = cloneState(state);
                next.page = Math.max(1, Number(page) || 1);
                return fetchState(next, false);
            },
            clearFilters: function () {
                return replace({ rating: null, answers: {}, search: '' });
            },
            retry: function () {
                return fetchState(state, false);
            },
            recordVote: function (reviewId, direction) {
                if (!reviewId || (direction !== 'up' && direction !== 'down')) return;
                cache.forEach(function (data) {
                    var reviews = data && data.reviews;
                    if (!reviews) return;
                    reviews.forEach(function (review) {
                        if (!review || review.id !== reviewId) return;
                        if (direction === 'up') review.helpfulCount = (Number(review.helpfulCount) || 0) + 1;
                        else review.unhelpfulCount = (Number(review.unhelpfulCount) || 0) + 1;
                    });
                });
            },
            destroy: function () {
                if (controller) controller.abort();
                controller = null;
                listeners = [];
            },
        };
    }

    var core = { create: create };
    root.ReviewsCore = core;
    if (typeof module !== 'undefined' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);
