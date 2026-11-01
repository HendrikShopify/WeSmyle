/**
 * <product-reviews> renders normalized review data.
 * Starts a load when the element connects.
 */
(function () {
    'use strict';

    var RECOMMEND_KEY = 'recommend';
    var VOTES_KEY = 'reviews_votes';

    function voteEntry(value) {
        if (value === 'up' || value === 'down') return { direction: value, count: null };
        if (!value || typeof value !== 'object') return null;
        if (value.direction !== 'up' && value.direction !== 'down') return null;
        var count = Number(value.count);
        return { direction: value.direction, count: Number.isFinite(count) ? count : null };
    }

    function formatDate(value, locale) {
        var date = new Date(value);
        if (!value || Number.isNaN(date.getTime())) return '';
        // Figma Review card: "12 October 2026", day first in every locale
        var month = new Intl.DateTimeFormat(locale || undefined, { month: 'long' }).format(date);
        return date.getDate() + ' ' + month + ' ' + date.getFullYear();
    }

    function clearNode(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function pageParts(current, total) {
        var start = Math.max(2, current - 1);
        var end = Math.min(total - 1, current + 1);
        if (current === 1) end = Math.min(total - 1, 3);
        if (current === total) start = Math.max(2, total - 2);
        var pages = [1];
        if (start > 2) pages.push('ellipsis');
        for (var i = start; i <= end; i += 1) pages.push(i);
        if (end < total - 1) pages.push('ellipsis');
        if (total > 1) pages.push(total);
        return pages;
    }

    class ProductReviews extends BaseComponent {
        init() {
            if (this.started) return;
            this.started = true;

            var configNode = this.querySelector('[data-reviews-config]');
            var adapter = window.ReviewsAdapters && window.ReviewsAdapters.judgeme;
            if (!configNode || !adapter || !window.ReviewsCore) {
                console.error('[reviews] adapter or core missing');
                return;
            }

            this.config = JSON.parse(configNode.textContent);
            this.list = this.querySelector('[data-reviews-list]');
            this.summary = this.querySelector('[data-reviews-summary]');
            this.histogram = this.querySelector('[data-reviews-histogram]');
            this.histogramTemplate = this.querySelector('template[data-reviews-histogram-row]');
            this.filtersEl = this.querySelector('[data-reviews-filters]');
            this.sortEl = this.querySelector('[data-reviews-sort]');
            this.dropdownTemplate = this.querySelector('[data-reviews-dropdown]');
            this.optionTemplate = this.querySelector('[data-reviews-option]');
            this.chipTemplate = this.querySelector('template[data-reviews-chip]');
            this.chipList = this.querySelector('[data-reviews-chip-list]');
            this.chips = this.querySelector('[data-reviews-chips]');
            this.search = this.querySelector('[data-reviews-search]');
            this.clearButtons = this.querySelectorAll('[data-reviews-clear]');
            this.emptyMessageEl = this.querySelector('[data-reviews-empty-message]');
            this.emptyActions = this.querySelectorAll('[data-reviews-empty-action]');
            this.pagination = this.querySelector('[data-reviews-pagination]');
            this.pagesEl = this.querySelector('[data-reviews-pages]');
            this.pageTemplate = this.querySelector('template[data-reviews-page]');
            this.pageCurrentTemplate = this.querySelector('template[data-reviews-page-current]');
            this.pagePrevTemplate = this.querySelector('template[data-reviews-page-prev]');
            this.pageNextTemplate = this.querySelector('template[data-reviews-page-next]');
            this.pageEllipsisTemplate = this.querySelector('template[data-reviews-page-ellipsis]');
            this.writeButton = this.querySelector('[data-reviews-write]');
            this.empty = this.querySelector('[data-reviews-empty]');
            this.retryButton = this.querySelector('[data-reviews-retry]');
            this.cardTemplate = this.querySelector('[data-reviews-card]');
            this.answerTemplate = this.querySelector('[data-reviews-answer]');
            this.photoTemplate = this.querySelector('[data-reviews-photo]');
            this.videoTemplate = this.querySelector('[data-reviews-video]');
            this.lightbox = this.querySelector('media-lightbox');
            var drawerId = this.writeButton && this.writeButton.getAttribute('data-drawer-trigger');
            this.formDrawer = drawerId ? this.querySelector('side-drawer[data-modal="' + drawerId + '"]') : null;
            this.formTemplate = this.querySelector('template[data-reviews-form]');
            this.formQuestionTemplate = this.querySelector('template[data-reviews-form-question]');
            this.formOptionTemplate = this.querySelector('template[data-reviews-form-option]');
            this.adapter = adapter;
            this.core = window.ReviewsCore.create({ adapter: adapter, config: this.config });
            this.sessionVotes = {};
            this.filters = [];
            this.dropdownId = 0;
            this.bindControls();
            this.mountReviewForm();
            this.buildSort();
            this.unsubscribe = this.core.subscribe(this.onSnapshot.bind(this));
            this.core.load();
        }

        disconnectedCallback() {
            if (this.unsubscribe) this.unsubscribe();
            if (this.core) this.core.destroy();
            if (this.lightbox && this.lightbox.close) this.lightbox.close();
            if (this.formDrawer && this.formDrawer.isOpen) this.formDrawer.close();
            this.clearFormPhotos();
            clearTimeout(this.searchTimer);
            this.clearVoteErrorTimers();
            this.listBar = false;
            this.formBar = false;
            this.syncLoadingBar();
            this.formDrawerBound = false;
            this.started = false;
            super.disconnectedCallback();
        }

        syncLoadingBar() {
            var on = !!(this.listBar || this.formBar);
            if (!!this.loadingBar === on) return;
            this.loadingBar = on;
            document.dispatchEvent(new Event(on ? 'loading:start' : 'loading:end'));
        }

        onSnapshot(snapshot) {
            if (!snapshot || !this.list) return;
            var loading = snapshot.status === 'loading';
            this.listBar = loading;
            this.syncLoadingBar();
            var hasReviews = !!this.list.querySelector('[data-reviews-card]:not([data-loading])');
            if (loading && hasReviews) this.list.setAttribute('data-loading', '');
            else this.list.removeAttribute('data-loading');
            this.list.setAttribute('aria-busy', loading ? 'true' : 'false');
            if (this.pagination) this.pagination.setAttribute('aria-busy', loading ? 'true' : 'false');

            if (loading) {
                this.showEmpty(null);
                return;
            }

            if (snapshot.status === 'error') {
                this.list.querySelectorAll('[data-reviews-card][data-loading]').forEach(function (card) {
                    card.remove();
                });
                this.showEmpty('error', (this.config.labels && this.config.labels.error) || '');
                return;
            }

            this.showEmpty(null);
            if (snapshot.status !== 'ready' || !snapshot.data) return;
            this.renderSummary(snapshot);
            this.ensureFilters(snapshot.data.questions || []);
            this.mountFormQuestions(snapshot.data.questions || []);
            this.updateControls(snapshot);
            if (!snapshot.append) {
                if (this.lightbox && this.lightbox.close) this.lightbox.close();
                clearNode(this.list);
                if (!snapshot.data.reviews.length) {
                    var state = snapshot.state || {};
                    var hasFilter = !!(state.rating || state.search || Object.keys(state.answers || {}).length);
                    this.showEmpty(hasFilter ? 'filters' : 'empty', this.emptyMessage(state));
                }
            }
            snapshot.data.reviews.forEach(function (review) {
                this.list.appendChild(this.renderCard(review));
            }, this);
        }

        renderSummary(snapshot) {
            var summary = snapshot.data.summary;
            if (!summary || !this.summary) return;

            var average = Number(summary.average) || 0;
            var count = Number(summary.count) || 0;
            var averageLabel = average.toFixed(1);
            var labels = this.config.labels || {};

            this.querySelector('[data-reviews-average]').textContent = averageLabel;

            var stars = this.querySelector('[data-reviews-summary-stars]');
            stars.setAttribute('aria-label', String(labels.stars || '').replace('__RATING__', averageLabel));
            stars.querySelectorAll('[data-reviews-summary-fill]').forEach(function (fill, index) {
                var fraction = Math.max(0, Math.min(1, average - index));
                fill.style.width = (fraction * 100) + '%';
            });

            var basedTemplate = count === 1 ? labels.basedOnOne : labels.basedOnOther;
            this.querySelector('[data-reviews-based]').textContent = String(basedTemplate || '').replace('__COUNT__', String(count));

            this.renderHistogram(summary, snapshot.state.rating);
            this.summary.hidden = false;
        }

        renderHistogram(summary, activeRating) {
            if (!this.histogram || !this.histogramTemplate) return;
            clearNode(this.histogram);

            var counts = {};
            (summary.histogram || []).forEach(function (row) {
                counts[Number(row.rating)] = Number(row.count) || 0;
            });

            var total = Number(summary.count) || 0;
            var labels = this.config.labels || {};

            for (var rating = 5; rating >= 1; rating -= 1) {
                var count = counts[rating] || 0;
                var pressed = Number(activeRating) === rating;
                var row = this.histogramTemplate.content.cloneNode(true);
                var button = row.querySelector('[data-reviews-histogram-row]');
                button.setAttribute('data-rating', String(rating));
                button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
                if (pressed) button.setAttribute('data-active', '');
                else button.removeAttribute('data-active');
                button.querySelector('[data-reviews-histogram-rating]').textContent = String(rating);
                button.querySelector('[data-reviews-histogram-count]').textContent = String(count);
                button.querySelector('[data-reviews-histogram-fill]').style.width = (total ? (count / total) * 100 : 0) + '%';
                button.setAttribute('aria-label', String(labels.histogram || '')
                    .replace('__RATING__', String(rating))
                    .replace('__COUNT__', String(count)));
                button.addEventListener('click', this.onHistogramClick.bind(this));
                this.histogram.appendChild(row);
            }
        }

        onHistogramClick(event) {
            var rating = Number(event.currentTarget.getAttribute('data-rating'));
            var current = Number(this.core.getSnapshot().state.rating);
            this.core.setRating(current === rating ? null : rating);
        }

        bindControls() {
            if (this.list) this.listen(this.list, 'click', this.onListClick.bind(this));
            if (this.search) this.listen(this.search, 'input', this.onSearchInput.bind(this));
            this.clearButtons.forEach(function (button) {
                this.listen(button, 'click', function () {
                    this.core.clearFilters();
                }.bind(this));
            }, this);
            if (this.writeButton) this.listen(this.writeButton, 'click', this.onWriteReview.bind(this));
            if (this.retryButton) this.listen(this.retryButton, 'click', function () {
                this.core.retry();
            }.bind(this));
            if (this.formDrawer && !this.formDrawerBound) {
                this.formDrawerBound = true;
                this.listen(this.formDrawer, 'drawer:close', function () {
                    if (this.formSubmitController) this.formSubmitController.abort();
                }.bind(this));
                this.listen(this.formDrawer, 'drawer:open', this.onFormDrawerOpen.bind(this));
            }
        }

        openMedia(items, index) {
            if (!this.lightbox || !this.lightbox.setItems || !items || !items.length) return;
            var labels = this.config.labels || {};
            this.lightbox.setItems(items);
            this.lightbox.dialog.setAttribute('aria-label', items[index].type === 'video' ? labels.video || '' : labels.photo || '');
            this.lightbox.open(index + 1);
        }

        buildSort() {
            if (!this.sortEl || !this.dropdownTemplate || this.sortDropdown) return;
            var sorts = (this.adapter.capabilities && this.adapter.capabilities.sorts) || [];
            var labels = (this.config.labels && this.config.labels.sorts) || {};
            var options = sorts.map(function (sort) {
                return { value: sort, label: labels[sort] || sort };
            });
            this.sortDropdown = this.createDropdown(labels.newest || 'Most recent', options, function (value) {
                this.core.setSort(value);
            }.bind(this));
            this.sortEl.appendChild(this.sortDropdown.root);
        }

        ensureFilters(questions) {
            if (this.filtersReady || !this.filtersEl) return;
            this.filtersReady = true;
            questions.forEach(function (question) {
                if (!question || question.key === RECOMMEND_KEY) return;
                var dropdown = this.createDropdown(question.label, this.questionOptions(question), function (value) {
                    var current = this.core.getSnapshot().state.answers[String(question.id)];
                    this.core.setAnswer(question.id, String(current || '') === String(value) ? null : value);
                }.bind(this));
                dropdown.question = question;
                this.filters.push(dropdown);
                this.filtersEl.appendChild(dropdown.root);
            }, this);
        }

        questionOptions(question) {
            var aggregates = this.config.aggregates && this.config.aggregates.questions;
            var entry = aggregates && aggregates[question.key];
            return (question.options || []).map(function (value) {
                var count = entry && entry.options ? entry.options[value] : undefined;
                return {
                    value: String(value),
                    label: count === undefined || count === null ? String(value) : String(value) + ' (' + count + ')',
                };
            });
        }

        updateControls(snapshot) {
            var state = snapshot.state || {};
            var labels = this.config.labels || {};
            var sortLabels = labels.sorts || {};

            if (this.sortDropdown) this.setSelectValue(this.sortDropdown, state.sort, sortLabels[state.sort] || state.sort);

            this.filters.forEach(function (filter) {
                var selected = state.answers[String(filter.question.id)];
                var option = filter.list.querySelector('[role="option"][data-value="' + String(selected || '').replace(/"/g, '\\"') + '"]');
                var label = option ? (option.querySelector('[data-menu-item-label]') || option).textContent.trim() : selected;
                this.setSelectValue(filter, selected || null, label);
            }, this);

            this.renderChips(state);
            this.renderPagination(snapshot);
            if (this.search && document.activeElement !== this.search) this.search.value = state.search || '';
            if (this.scrollOnReady) {
                this.scrollOnReady = false;
                var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                this.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
            }
        }

        renderChips(state) {
            if (!this.chipList || !this.chips || !this.chipTemplate) return;
            clearNode(this.chipList);
            var labels = this.config.labels || {};

            if (state.rating) this.addChip(state.rating + ' stars', function () {
                this.core.setRating(null);
            }.bind(this));

            Object.keys(state.answers || {}).forEach(function (questionId) {
                var value = state.answers[questionId];
                if (!value) return;
                var filter = this.filters.find(function (item) {
                    return String(item.question.id) === String(questionId);
                });
                var label = (filter ? filter.question.label : questionId) + ': ' + value;
                this.addChip(label, function () {
                    this.core.setAnswer(questionId, null);
                }.bind(this));
            }, this);

            if (state.search) this.addChip(state.search, function () {
                this.core.setSearch('');
            }.bind(this));

            this.chips.hidden = !this.chipList.childElementCount;
            this.chipList.querySelectorAll('[data-reviews-chip]').forEach(function (chip) {
                var label = chip.querySelector('[data-reviews-chip-label]').textContent;
                chip.setAttribute('aria-label', String(labels.removeFilter || '').replace('__LABEL__', label));
            });
        }

        addChip(label, onRemove) {
            var node = this.chipTemplate.content.cloneNode(true);
            var button = node.querySelector('[data-reviews-chip]');
            button.querySelector('[data-reviews-chip-label]').textContent = label;
            button.addEventListener('click', onRemove);
            this.chipList.appendChild(node);
        }

        renderPagination(snapshot) {
            if (!this.pagination || !this.pagesEl || !this.pageTemplate || !snapshot.data.page) return;
            var page = snapshot.data.page;
            var current = Number(page.page) || 1;
            var total = Number(page.totalPages) || 1;
            clearNode(this.pagesEl);
            this.pagination.hidden = total < 2;
            if (total < 2) return;

            var labels = this.config.labels || {};
            var parts = [{ type: 'prev' }].concat(pageParts(current, total)).concat([{ type: 'next' }]);
            parts.forEach(function (part) {
                var type = part.type || (part === 'ellipsis' ? 'ellipsis' : 'page');
                var template = this.pageTemplate;
                if (type === 'ellipsis') template = this.pageEllipsisTemplate;
                else if (type === 'prev') template = this.pagePrevTemplate;
                else if (type === 'next') template = this.pageNextTemplate;
                else if (part === current) template = this.pageCurrentTemplate;
                var node = template.content.cloneNode(true);
                var button = node.querySelector('[data-reviews-page]');
                if (type === 'ellipsis') {
                    this.pagesEl.appendChild(node);
                    return;
                }
                if (type === 'prev' || type === 'next') {
                    var target = type === 'prev' ? current - 1 : current + 1;
                    button.disabled = target < 1 || target > total;
                    button.addEventListener('click', function () {
                        this.goToPage(target);
                    }.bind(this));
                } else {
                    button.textContent = String(part);
                    button.setAttribute('aria-label', String(labels.page || '').replace('__NUMBER__', String(part)));
                    if (part === current) button.setAttribute('aria-current', 'page');
                    button.addEventListener('click', function () {
                        this.goToPage(part);
                    }.bind(this));
                }
                this.pagesEl.appendChild(node);
            }, this);
        }

        goToPage(page) {
            var current = Number(this.core.getSnapshot().state.page) || 1;
            if (page === current) return;
            this.scrollOnReady = true;
            this.core.setPage(page);
        }

        // type: null hides the block; 'empty' | 'filters' | 'error' shows the message and the matching action
        showEmpty(type, message) {
            if (!this.empty) return;
            this.empty.hidden = !type;
            if (this.emptyMessageEl) this.emptyMessageEl.textContent = type ? (message || '') : '';
            this.emptyActions.forEach(function (action) {
                action.hidden = action.getAttribute('data-reviews-empty-action') !== type;
            });
        }

        emptyMessage(state) {
            var labels = this.config.labels || {};
            var hasFilter = !!(state.rating || state.search || Object.keys(state.answers || {}).length);
            return hasFilter ? (labels.emptyFilters || '') : (labels.empty || '');
        }

        onSearchInput() {
            clearTimeout(this.searchTimer);
            var value = this.search.value.trim();
            if (!value) {
                this.core.setSearch('');
                return;
            }
            if (value.length < 2) return;
            this.searchTimer = setTimeout(function () {
                this.core.setSearch(value);
            }.bind(this), 300);
        }

        onWriteReview() {
            if (this.formDrawer) return;
            var opened = this.adapter && typeof this.adapter.openForm === 'function' && this.adapter.openForm();
            if (!opened) console.warn('[reviews] review form could not be opened');
        }

        onFormDrawerOpen() {
            if (!this.form) return;
            var success = this.formDrawer.querySelector('[data-reviews-form-success]');
            if (success && !success.hidden) {
                var successClose = success.querySelector('[data-reviews-form-success-close]');
                if (successClose) successClose.focus();
                return;
            }
            var firstRating = this.form.querySelector('[data-reviews-form-rating] input');
            if (firstRating) firstRating.focus();
        }

        mountReviewForm() {
            if (this.formBound || !this.formDrawer || !this.formTemplate) return;
            var root = this.querySelector('[data-reviews-form-root]');
            var slot = this.formDrawer.querySelector('[data-drawer-body]');
            if (!root || !slot) return;
            this.formBound = true;
            slot.appendChild(root);
            root.hidden = false;
            if (!root.querySelector('form')) root.appendChild(this.formTemplate.content.cloneNode(true));
            this.form = root.querySelector('form');
            if (!this.form) return;
            var format = this.config.nameFormat || 'customer';
            var nameFormat = this.form.querySelector('[data-reviews-form-name-format]');
            if (nameFormat) nameFormat.hidden = format !== 'customer';
            this.formPhotos = [];
            this.formPhotoTemplate = this.querySelector('template[data-reviews-form-photo]');
            var photoInput = this.form.querySelector('[data-reviews-form-photos]');
            if (photoInput) photoInput.addEventListener('change', this.onFormPhotos.bind(this));
            this.form.addEventListener('submit', this.onFormSubmit.bind(this));
            var successClose = root.querySelector('[data-reviews-form-success-close]');
            if (successClose) successClose.addEventListener('click', function () { this.formDrawer.close(); }.bind(this));
            if (this.hasSubmittedReview()) this.showFormSuccess(false);
        }

        mountFormQuestions(questions) {
            if (this.formQuestionsReady || !this.form || !this.formQuestionTemplate || !this.formOptionTemplate) return;
            var container = this.form.querySelector('[data-reviews-form-questions]');
            if (!container) return;
            this.formQuestionsReady = true;
            var required = this.requiredQuestionKeys();
            questions.forEach(function (question) {
                if (!question || !question.options || !question.options.length) return;
                container.appendChild(this.renderFormQuestion(question, required.indexOf(question.key) !== -1));
            }, this);
        }

        requiredQuestionKeys() {
            return String(this.config.requiredQuestions || '').split(',').map(function (key) {
                return key.trim();
            }).filter(Boolean);
        }

        renderFormQuestion(question, required) {
            var node = this.formQuestionTemplate.content.cloneNode(true);
            var fieldset = node.querySelector('[data-reviews-form-question]');
            var optionsEl = node.querySelector('[data-reviews-form-question-options]');
            var error = node.querySelector('[data-reviews-form-error]');
            var options = question.options || [];
            fieldset.setAttribute('data-question-id', String(question.id));
            fieldset.setAttribute('data-question-key', question.key);
            if (required) fieldset.setAttribute('data-required', '');
            node.querySelector('[data-reviews-form-question-label]').textContent = question.label || '';
            error.id = 'ReviewsFormQuestionError-' + question.id;
            options.forEach(function (value, index) {
                var option = this.formOptionTemplate.content.cloneNode(true);
                var input = option.querySelector('[data-reviews-form-option]');
                input.id = 'ReviewsFormQuestion-' + question.id + '-' + index;
                input.name = 'question-' + question.id;
                input.value = String(value);
                if (required) input.required = true;
                option.querySelector('[data-reviews-form-option-label]').textContent = String(value);
                optionsEl.appendChild(option);
            }, this);
            return node;
        }

        onFormSubmit(event) {
            event.preventDefault();
            if (!this.form) return;
            if (this.formSubmitting) return;
            var honeypot = this.form.querySelector('[name="website"]');
            if (honeypot && honeypot.value) {
                this.showFormSuccess(false);
                return;
            }

            var labels = (this.config.labels && this.config.labels.form) || {};
            var invalid = [];
            var rating = this.form.querySelector('[data-reviews-form-rating]');
            var ratingChecked = rating && rating.querySelector('input:checked');
            var ratingMessage = ratingChecked ? '' : (labels.ratingRequired || '');
            this.setGroupError(rating, ratingMessage);
            if (ratingMessage) invalid.push(rating);

            invalid = invalid.concat(this.validateControl(
                this.form.querySelector('[data-reviews-form-body]'),
                function (value) { return value ? '' : (labels.bodyRequired || ''); }
            ));
            var photoInput = this.form.querySelector('[data-reviews-form-photos]');
            var photoMessage = this.formPhotoMessage(labels);
            if (photoInput && photoMessage) {
                this.setControlError(photoInput, photoMessage);
                invalid.push(photoInput);
            }
            this.form.querySelectorAll('[data-reviews-form-question]').forEach(function (fieldset) {
                var answered = !!fieldset.querySelector('input:checked');
                var message = fieldset.hasAttribute('data-required') && !answered ? (labels.questionRequired || '') : '';
                this.setGroupError(fieldset, message);
                if (message) invalid.push(fieldset);
            }, this);
            invalid = invalid.concat(this.validateControl(
                this.form.querySelector('[data-reviews-form-email]'),
                function (value) {
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : (labels.emailInvalid || '');
                }
            ));
            invalid = invalid.concat(this.validateControl(
                this.form.querySelector('[data-reviews-form-name]'),
                function (value) { return value ? '' : (labels.nameRequired || ''); }
            ));

            if (invalid.length) {
                var first = invalid[0];
                var target = first.matches('input, textarea, select') ? first : first.querySelector('input, textarea, select');
                if (target) target.focus();
                return;
            }
            this.sendReview();
        }

        formValue(selector) {
            var field = this.form.querySelector(selector);
            return field ? field.value.trim() : '';
        }

        formData(files) {
            var answers = {};
            this.form.querySelectorAll('[data-reviews-form-question]').forEach(function (fieldset) {
                var checked = fieldset.querySelector('input:checked');
                if (!checked) return;
                answers[fieldset.getAttribute('data-question-id')] = checked.value;
            });
            var nameFormat = this.config.nameFormat && this.config.nameFormat !== 'customer'
                ? this.config.nameFormat
                : 'full';
            if (!this.config.nameFormat || this.config.nameFormat === 'customer') {
                var picked = this.form.querySelector('[name="name-format"]:checked');
                nameFormat = picked ? picked.value : 'full';
            }
            var rating = this.form.querySelector('[data-reviews-form-rating] input:checked');
            return {
                rating: rating ? Number(rating.value) : 0,
                title: this.formValue('[data-reviews-form-title]'),
                body: this.formValue('[data-reviews-form-body]'),
                name: this.formValue('[data-reviews-form-name]'),
                email: this.formValue('[data-reviews-form-email]'),
                nameFormat: nameFormat,
                answers: answers,
                files: files,
            };
        }

        submittedKey() {
            return 'reviews_submitted_' + String(this.config.productId);
        }

        hasSubmittedReview() {
            try {
                return sessionStorage.getItem(this.submittedKey()) === '1';
            } catch (e) {
                return false;
            }
        }

        showFormSuccess(persist) {
            var success = this.formDrawer && this.formDrawer.querySelector('[data-reviews-form-success]');
            if (!success) return;
            if (persist) {
                try {
                    sessionStorage.setItem(this.submittedKey(), '1');
                } catch (e) {}
            }
            var message = success.querySelector('[data-reviews-form-success-message]');
            if (message) message.textContent = this.config.formSuccessMessage || '';
            if (this.form) this.form.hidden = true;
            success.hidden = false;
            this.clearFormPhotos();
            if (this.formDrawer.isOpen) {
                var close = success.querySelector('[data-reviews-form-success-close]');
                if (close) close.focus();
            }
        }

        setFormBusy(busy) {
            var button = this.form && this.form.querySelector('[data-reviews-form-submit]');
            if (button) button.disabled = !!busy;
            this.formBar = !!busy;
            this.syncLoadingBar();
        }

        setFormStatus(message, isError) {
            var status = this.form && this.form.querySelector('[data-reviews-form-status]');
            if (!status) return;
            this.setHelperText(status, message);
            status.hidden = !message;
            status.classList.toggle('text-error', !!isError);
            status.classList.toggle('text-text-muted', !isError);
        }

        formProgressText(labels, current, total) {
            return String(labels.uploading || '')
                .replace('__CURRENT__', String(current))
                .replace('__TOTAL__', String(total));
        }

        formSubmitError(labels, error) {
            if (error && error.fileName) {
                return String(labels.photoUpload || error.message || labels.error || '').replace('__NAME__', error.fileName);
            }
            if (error && error.message) return error.message;
            return labels.error || '';
        }

        sendReview() {
            var labels = (this.config.labels && this.config.labels.form) || {};
            if (!this.adapter || typeof this.adapter.submitReview !== 'function') {
                this.setFormStatus(labels.error || '', true);
                return;
            }
            var files = (this.formPhotos || []).map(function (item) { return item.file; });
            this.formSubmitting = true;
            this.setFormBusy(true);
            this.setFormStatus(files.length ? this.formProgressText(labels, 1, files.length) : (labels.sending || ''), false);
            var controller = typeof AbortController === 'function' ? new AbortController() : null;
            this.formSubmitController = controller;
            this.adapter.submitReview(this.config, this.formData(files), {
                signal: controller && controller.signal,
                onProgress: function (progress) {
                    var uploaded = progress.uploaded || 0;
                    var total = progress.total || files.length;
                    if (uploaded >= total) this.setFormStatus(labels.sending || '', false);
                    else this.setFormStatus(this.formProgressText(labels, uploaded + 1, total), false);
                }.bind(this),
            }).then(function () {
                this.formSubmitting = false;
                this.formSubmitController = null;
                this.setFormBusy(false);
                this.showFormSuccess(true);
            }.bind(this)).catch(function (error) {
                this.formSubmitting = false;
                this.formSubmitController = null;
                this.setFormBusy(false);
                if (error && error.name === 'AbortError') {
                    this.setFormStatus('', false);
                    return;
                }
                this.setFormStatus(this.formSubmitError(labels, error), true);
            }.bind(this));
        }

        validateControl(input, check) {
            if (!input) return [];
            var message = check(input.value.trim());
            this.setControlError(input, message);
            return message ? [input] : [];
        }

        setControlError(input, message) {
            var field = input.closest('[data-reviews-form-field]') || input.parentElement;
            var error = field && field.querySelector('[data-reviews-form-error]');
            var hint = field && field.querySelector('[data-reviews-form-hint]');
            var invalid = !!message;
            if (invalid) input.setAttribute('aria-invalid', 'true');
            else input.removeAttribute('aria-invalid');
            if (hint) hint.hidden = invalid;
            if (!error) return;
            error.hidden = !invalid;
            this.setHelperText(error, message);
            var ids = String(input.getAttribute('data-describedby') || '').split(/\s+/).filter(Boolean);
            if (invalid && error.id && ids.indexOf(error.id) === -1) ids.push(error.id);
            if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
            else input.removeAttribute('aria-describedby');
        }

        // Helper text keeps its icon, the message goes in [data-helper-text].
        setHelperText(element, message) {
            var slot = element.querySelector('[data-helper-text]') || element;
            slot.textContent = message || '';
        }

        setGroupError(fieldset, message) {
            if (!fieldset) return;
            var error = fieldset.querySelector('[data-reviews-form-error]');
            var invalid = !!message;
            if (invalid) fieldset.setAttribute('aria-invalid', 'true');
            else fieldset.removeAttribute('aria-invalid');
            if (error) {
                error.hidden = !invalid;
                this.setHelperText(error, message);
            }
            fieldset.querySelectorAll('input').forEach(function (input) {
                if (invalid && error) {
                    input.setAttribute('aria-invalid', 'true');
                    if (error.id) input.setAttribute('aria-describedby', error.id);
                } else {
                    input.removeAttribute('aria-invalid');
                    input.removeAttribute('aria-describedby');
                }
            });
        }

        formPhotoLimits() {
            var form = (this.adapter && this.adapter.capabilities && this.adapter.capabilities.form) || {};
            return {
                maxPhotos: Number(form.maxPhotos) || 5,
                maxPhotoSize: Number(form.maxPhotoSize) || 10485760,
            };
        }

        formPhotoMessage(labels) {
            labels = labels || ((this.config.labels && this.config.labels.form) || {});
            var limits = this.formPhotoLimits();
            var photos = this.formPhotos || [];
            if (photos.length > limits.maxPhotos) {
                return String(labels.photoCount || '').replace('__COUNT__', String(limits.maxPhotos));
            }
            var tooBig = photos.find(function (item) {
                return item.file.size > limits.maxPhotoSize;
            });
            if (tooBig) return String(labels.photoSize || '').replace('__NAME__', tooBig.file.name);
            return '';
        }

        onFormPhotos(event) {
            var input = event.currentTarget;
            var selected = Array.prototype.slice.call(input.files || []);
            input.value = '';
            var limits = this.formPhotoLimits();
            var labels = (this.config.labels && this.config.labels.form) || {};
            var rejected = [];
            this.formPhotos = this.formPhotos || [];
            selected.forEach(function (file) {
                if (!file || String(file.type || '').indexOf('image/') !== 0) return;
                if (file.size > limits.maxPhotoSize) {
                    rejected.push(file);
                    return;
                }
                this.formPhotos.push({ file: file, url: URL.createObjectURL(file) });
            }, this);
            var overflow = this.formPhotos.splice(limits.maxPhotos);
            overflow.forEach(function (item) {
                URL.revokeObjectURL(item.url);
            });
            var messages = [];
            if (overflow.length) messages.push(String(labels.photoCount || '').replace('__COUNT__', String(limits.maxPhotos)));
            rejected.forEach(function (file) {
                messages.push(String(labels.photoSize || '').replace('__NAME__', file.name));
            });
            this.renderFormPhotos();
            this.setControlError(input, messages.join(' '));
        }

        renderFormPhotos() {
            var list = this.form && this.form.querySelector('[data-reviews-form-previews]');
            if (!list || !this.formPhotoTemplate) return;
            clearNode(list);
            var removeLabel = ((this.config.labels && this.config.labels.form) || {}).removePhoto || '';
            (this.formPhotos || []).forEach(function (item, index) {
                var node = this.formPhotoTemplate.content.cloneNode(true);
                var img = node.querySelector('img');
                img.src = item.url;
                img.alt = item.file.name;
                var button = node.querySelector('[data-reviews-form-photo-remove]');
                button.setAttribute('aria-label', String(removeLabel).replace('__NAME__', item.file.name));
                button.addEventListener('click', function () {
                    this.removeFormPhoto(index);
                }.bind(this));
                list.appendChild(node);
            }, this);
        }

        removeFormPhoto(index) {
            var item = (this.formPhotos || []).splice(index, 1)[0];
            if (item && item.url) URL.revokeObjectURL(item.url);
            this.renderFormPhotos();
            var input = this.form && this.form.querySelector('[data-reviews-form-photos]');
            if (input) this.setControlError(input, this.formPhotoMessage());
        }

        clearFormPhotos() {
            (this.formPhotos || []).forEach(function (item) {
                if (item.url) URL.revokeObjectURL(item.url);
            });
            this.formPhotos = [];
        }

        // Builds a Select (snippets/select.liquid) from the template: options go in before the element is attached,
        // so custom-select.js finds them on connect. Returns { root, placeholder } for updateControls.
        createDropdown(label, options, onSelect) {
            var node = this.dropdownTemplate.content.cloneNode(true);
            var root = node.querySelector('[data-reviews-dropdown]');
            var button = root.querySelector('button[aria-haspopup="listbox"]');
            var list = root.querySelector('[role="listbox"]');
            var labelEl = root.querySelector('[data-selected-label]');
            var id = 'reviews-select-' + this.dropdownId;
            this.dropdownId += 1;
            button.id = id;
            list.id = id + '-listbox';
            button.setAttribute('aria-controls', list.id);
            list.setAttribute('aria-labelledby', id);
            labelEl.textContent = label;
            labelEl.classList.add('text-text-muted');

            options.forEach(function (option, index) {
                var item = this.optionTemplate.content.cloneNode(true);
                var el = item.querySelector('[data-reviews-option]');
                (el.querySelector('[data-menu-item-label]') || el).textContent = option.label;
                el.setAttribute('data-value', option.value);
                el.setAttribute('aria-selected', 'false');
                el.id = id + '-option-' + (index + 1);
                list.appendChild(item);
            }, this);

            root.addEventListener('select:change', function (event) {
                onSelect(event.detail.value);
            });

            return { root: root, button: button, list: list, labelEl: labelEl, placeholder: label };
        }

        // Puts a Select into the given value without firing select:change (the state already changed).
        setSelectValue(dropdown, value, valueLabel) {
            var has = value !== null && value !== undefined && value !== '';
            dropdown.list.querySelectorAll('[role="option"]').forEach(function (option) {
                var selected = has && option.getAttribute('data-value') === String(value);
                option.setAttribute('aria-selected', selected ? 'true' : 'false');
            });
            var input = dropdown.root.querySelector('input[type="hidden"]');
            if (input) input.value = has ? String(value) : '';
            dropdown.labelEl.textContent = has ? (valueLabel || String(value)) : dropdown.placeholder;
            dropdown.labelEl.classList.toggle('text-text-muted', !has);
            dropdown.button.setAttribute('aria-selected', has ? 'true' : 'false');
        }

        renderCard(review) {
            var node = this.cardTemplate.content.cloneNode(true);
            var answers = review.answers || [];
            var recommend = answers.find(function (answer) { return answer.key === RECOMMEND_KEY; });
            var attributes = answers.filter(function (answer) {
                return answer.key !== RECOMMEND_KEY && answer.value;
            });

            node.querySelector('[data-reviews-author]').textContent = review.isAnonymous
                ? this.config.labels.anonymous
                : (review.author || this.config.labels.anonymous);

            if (recommend && String(recommend.value).toLowerCase() === 'yes') {
                var recommendEl = node.querySelector('[data-reviews-recommend]');
                recommendEl.hidden = false;
                var recommendText = recommendEl.querySelector('[data-reviews-recommend-text]') || recommendEl;
                recommendText.textContent = this.config.recommendLabel;
            }

            if (attributes.length && this.answerTemplate) {
                var answersEl = node.querySelector('[data-reviews-answers]');
                answersEl.hidden = false;
                attributes.forEach(function (answer) {
                    var row = this.answerTemplate.content.cloneNode(true);
                    row.querySelector('[data-reviews-answer-label]').textContent = answer.label;
                    row.querySelector('[data-reviews-answer-value]').textContent = answer.value;
                    answersEl.appendChild(row);
                }, this);
            }

            var title = node.querySelector('[data-reviews-title]');
            if (review.title) title.textContent = review.title;
            else title.remove();

            var date = node.querySelector('[data-reviews-date]');
            var formatted = formatDate(review.date, this.config.locale);
            if (formatted) {
                date.textContent = formatted;
                date.setAttribute('datetime', review.date);
            } else {
                date.remove();
            }

            var stars = node.querySelector('[data-reviews-stars]');
            var rating = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0)));
            stars.setAttribute('aria-label', String(this.config.labels.stars || '').replace('__RATING__', String(rating)));
            stars.querySelectorAll('[data-reviews-star]').forEach(function (star, index) {
                if (index >= rating) star.setAttribute('data-empty', '');
                else star.removeAttribute('data-empty');
            });

            node.querySelector('[data-reviews-body]').innerHTML = review.bodyHtml || '';

            this.renderMedia(node, review);
            this.renderVote(node, review);

            if (review.reply && review.reply.bodyHtml) {
                var reply = node.querySelector('[data-reviews-reply]');
                reply.hidden = false;
                reply.querySelector('[data-reviews-reply-author]').textContent = review.reply.author || '';
                reply.querySelector('[data-reviews-reply-body]').innerHTML = review.reply.bodyHtml;
            }

            return node;
        }

        renderMedia(node, review) {
            var photos = review.photos || [];
            var videos = review.videos || [];
            var media = node.querySelector('[data-reviews-media]');
            if (!media || (!photos.length && !videos.length)) return;

            var gallery = [];
            var labels = this.config.labels || {};

            photos.forEach(function (photo) {
                var src = photo.full || photo.thumb;
                if (!this.photoTemplate || !photo.thumb || !src) return;
                var index = gallery.length;
                gallery.push({ type: 'photo', src: src });
                var item = this.photoTemplate.content.cloneNode(true);
                var img = item.querySelector('[data-reviews-photo-img]');
                img.src = photo.thumb;
                img.alt = labels.photo || '';
                var button = item.querySelector('[data-reviews-photo-open]');
                button.setAttribute('aria-label', labels.photo || '');
                button.addEventListener('click', function () {
                    this.openMedia(gallery, index);
                }.bind(this));
                media.appendChild(item);
            }, this);

            videos.forEach(function (video) {
                if (!this.videoTemplate || (!video.thumb && !video.src)) return;
                var item = this.videoTemplate.content.cloneNode(true);
                var img = item.querySelector('[data-reviews-video-img]');
                if (img && video.thumb) img.src = video.thumb;
                else if (img) img.remove();
                var button = item.querySelector('[data-reviews-video-open]');
                button.setAttribute('aria-label', labels.video || '');
                if (video.src) {
                    var index = gallery.length;
                    gallery.push({ type: 'video', src: video.src, poster: video.thumb || '' });
                    button.addEventListener('click', function () {
                        this.openMedia(gallery, index);
                    }.bind(this));
                }
                media.appendChild(item);
            }, this);

            if (media.childElementCount) media.hidden = false;
        }

        renderVote(node, review) {
            var vote = node.querySelector('[data-reviews-vote]');
            if (!vote) return;
            vote.setAttribute('data-review-id', review.id || '');
            var saved = voteEntry(this.readVotes()[review.id]);
            var helpful = Number(review.helpfulCount) || 0;
            var unhelpful = Number(review.unhelpfulCount) || 0;
            if (saved && saved.count != null) {
                if (saved.direction === 'up') helpful = Math.max(helpful, saved.count);
                else unhelpful = Math.max(unhelpful, saved.count);
            }
            var upCount = vote.querySelector('[data-reviews-vote-up-count]');
            var downCount = vote.querySelector('[data-reviews-vote-down-count]');
            if (upCount) upCount.textContent = String(helpful);
            if (downCount) downCount.textContent = String(unhelpful);
            if (!saved) return;
            var direction = saved.direction;
            var pressed = vote.querySelector(direction === 'up' ? '[data-reviews-vote-up]' : '[data-reviews-vote-down]');
            if (pressed) pressed.setAttribute('aria-pressed', 'true');
            vote.querySelectorAll('[data-reviews-vote-up], [data-reviews-vote-down]').forEach(function (button) {
                button.disabled = true;
            });
        }

        readVotes() {
            var stored = {};
            try {
                var parsed = JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed;
            } catch (e) {
                stored = {};
            }
            return Object.assign({}, stored, this.sessionVotes || {});
        }

        rememberVote(reviewId, direction, count) {
            var entry = { direction: direction, count: count };
            this.sessionVotes = this.sessionVotes || {};
            this.sessionVotes[reviewId] = entry;
            try {
                var votes = {};
                var parsed = JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) votes = parsed;
                votes[reviewId] = entry;
                localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
            } catch (e) {
                return;
            }
        }

        onListClick(event) {
            var button = event.target.closest('[data-reviews-vote-up], [data-reviews-vote-down]');
            if (!button || !this.list || !this.list.contains(button) || button.disabled) return;
            var vote = button.closest('[data-reviews-vote]');
            if (!vote) return;
            var reviewId = vote.getAttribute('data-review-id');
            if (!reviewId) return;
            var direction = button.hasAttribute('data-reviews-vote-up') ? 'up' : 'down';
            this.voteReview(vote, button, reviewId, direction);
        }

        voteReview(vote, button, reviewId, direction) {
            var voting = this.adapter && this.adapter.capabilities && this.adapter.capabilities.voting;
            if (!this.adapter || typeof this.adapter.voteReview !== 'function') {
                this.showVoteError(vote);
                return;
            }
            if (voting && voting[direction] === false) return;
            if (voteEntry(this.readVotes()[reviewId])) return;

            var count = vote.querySelector(
                direction === 'up' ? '[data-reviews-vote-up-count]' : '[data-reviews-vote-down-count]'
            );
            var previous = count ? (Number(count.textContent) || 0) : 0;
            if (count) count.textContent = String(previous + 1);
            button.setAttribute('aria-pressed', 'true');
            var buttons = vote.querySelectorAll('[data-reviews-vote-up], [data-reviews-vote-down]');
            buttons.forEach(function (item) {
                item.disabled = true;
            });
            this.hideVoteError(vote);

            this.adapter.voteReview(reviewId, direction).then(function () {
                var shown = count ? (Number(count.textContent) || 0) : previous + 1;
                this.rememberVote(reviewId, direction, shown);
                if (this.core && typeof this.core.recordVote === 'function') this.core.recordVote(reviewId, direction);
            }.bind(this)).catch(function () {
                if (!vote.isConnected) return;
                if (count) count.textContent = String(previous);
                button.setAttribute('aria-pressed', 'false');
                buttons.forEach(function (item) {
                    item.disabled = false;
                });
                this.showVoteError(vote);
            }.bind(this));
        }

        hideVoteError(vote) {
            var error = vote.querySelector('[data-reviews-vote-error]');
            if (error) error.hidden = true;
            this.clearVoteErrorTimer(vote.getAttribute('data-review-id'));
        }

        showVoteError(vote) {
            var error = vote.querySelector('[data-reviews-vote-error]');
            if (!error) return;
            var reviewId = vote.getAttribute('data-review-id') || '';
            error.hidden = false;
            this.clearVoteErrorTimer(reviewId);
            this.voteErrorTimers = this.voteErrorTimers || {};
            this.voteErrorTimers[reviewId] = setTimeout(function () {
                error.hidden = true;
                delete this.voteErrorTimers[reviewId];
            }.bind(this), 4000);
        }

        clearVoteErrorTimer(reviewId) {
            var timers = this.voteErrorTimers;
            if (!timers || !reviewId || !timers[reviewId]) return;
            clearTimeout(timers[reviewId]);
            delete timers[reviewId];
        }

        clearVoteErrorTimers() {
            var timers = this.voteErrorTimers || {};
            Object.keys(timers).forEach(function (reviewId) {
                clearTimeout(timers[reviewId]);
            });
            this.voteErrorTimers = {};
        }
    }

    if (!customElements.get('product-reviews')) {
        customElements.define('product-reviews', ProductReviews);
    }
})();
