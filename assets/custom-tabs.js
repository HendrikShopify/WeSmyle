/**
 * Custom Tabs — accessible tabs built from buttons + divs.
 *
 * Expected markup inside <custom-tabs>:
 * - [data-tab-list] (tab list container)
 * - [data-tab] (each tab)
 * - [data-tab-panel] (each panel)
 * 
 * explain all required attributes and their purpose
 * 
 * [data-tab-list] - container for the tab list
 * [data-tab] - each tab
 * [data-tab-panel] - each panel
 * [role="tablist"] - the tab list container
 * [role="tab"] - each tab
 * [role="tabpanel"] - each panel
 * [aria-label="Product information"] - the label for the tab list
 * [aria-selected="true"] - the selected tab
 * [tabindex="0"] - the selected tab
 * [tabindex="-1"] - the unselected tabs
 * [hidden] - the hidden panels
 * [aria-labelledby="tab-description"] - the label for the description panel
 * [aria-labelledby="tab-specifications"] - the label for the specifications panel
 * [aria-controls="panel-description"] - the panel for the description tab
 * [aria-controls="panel-specifications"] - the panel for the specifications tab
 * [aria-hidden="true"] - the hidden panels
 * [aria-hidden="false"] - the visible panels
 */


/* 

example markup:

<custom-tabs class="block">
  <div class="flex gap-y-[1rem]" data-tab-list="" role="tablist" aria-label="Product information"><button class="p-3 cursor-pointer" data-tab="" type="button" role="tab" aria-controls="panel-description" aria-selected="true">
    Description
  </button><button class="p-3 cursor-pointer" data-tab="" type="button" role="tab" aria-controls="panel-specifications" aria-selected="false" tabindex="-1">
    Specifications
  </button></div>
  <div class="block p-6" data-tab-panel="" role="tabpanel" aria-labelledby="tab-description">
    <div>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique. Duis cursus, mi quis viverra ornare, eros dolor interdum nulla, ut commodo diam libero vitae erat. Aenean faucibus nibh et justo cursus id rutrum lorem imperdiet. Nunc ut sem vitae risus tristique posuere.</p>
    </div>
  </div>
  <div class="block p-6" data-tab-panel="" role="tabpanel" aria-labelledby="tab-specifications" hidden="">
    <div>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique. Duis cursus, mi quis viverra ornare, eros dolor interdum nulla, ut commodo diam libero vitae erat. Aenean faucibus nibh et justo cursus id rutrum lorem imperdiet. Nunc ut sem vitae risus tristique posuere. About specs</p><img src="https://placehold.jp/1000x1000.png" />
    </div>
  </div>
</custom-tabs>

*/

class CustomTabs extends BaseComponent {
    constructor() {
        super();
        this.onKeydown = this.onKeydown.bind(this);
    }

    init() {
        this.tabs = [...this.querySelectorAll('[data-tab]')];
        this.panels = [...this.querySelectorAll('[data-tab-panel]')];

        this.tabs.forEach((tab, index) => {
            this.listen(tab, 'click', () => {
                this.activateTab(index);
            });
        });

        this.listen(this, 'keydown', this.onKeydown);
    }

    activateTab(index) {
        const activeTab = this.tabs[index];

        if (!activeTab) return;

        this.tabs.forEach((tab) => {
            tab.setAttribute('aria-selected', 'false');
            tab.setAttribute('tabindex', '-1');
        });

        this.panels.forEach((panel) => {
            panel.hidden = true;
        });

        activeTab.setAttribute('aria-selected', 'true');
        activeTab.setAttribute('tabindex', '0');

        const activePanel = this.getPanelForTab(index, activeTab);
        const panelId = activePanel?.id || activeTab.getAttribute('aria-controls');

        if (activePanel) {
            activePanel.hidden = false;

            const panelIdAttr = activePanel.id;
            if (panelIdAttr && activeTab.getAttribute('aria-controls') !== panelIdAttr) {
                activeTab.setAttribute('aria-controls', panelIdAttr);
            }
        }

        this.emit('tabs:change', {
            index,
            tab: activeTab,
            panel: activePanel,
            panelId,
        });
    }

    onKeydown(event) {
        const currentIndex = this.tabs.findIndex(
            (tab) => tab === document.activeElement
        );

        if (currentIndex === -1) return;

        let nextIndex = currentIndex;

        switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();

                nextIndex =
                    currentIndex === this.tabs.length - 1
                        ? 0
                        : currentIndex + 1;

                break;

            case 'ArrowLeft':
                event.preventDefault();

                nextIndex =
                    currentIndex === 0
                        ? this.tabs.length - 1
                        : currentIndex - 1;

                break;

            case 'Home':
                event.preventDefault();
                nextIndex = 0;
                break;

            case 'End':
                event.preventDefault();
                nextIndex = this.tabs.length - 1;
                break;

            default:
                return;
        }

        this.activateTab(nextIndex);
        this.tabs[nextIndex].focus();
    }

    /**
     * Resolves panel by aria-controls + id, then falls back to tab index.
     */
    getPanelForTab(index, tab) {
        const panelId = tab.getAttribute('aria-controls');

        if (panelId) {
            const panelById = this.panels.find((panel) => panel.id === panelId);
            if (panelById) return panelById;
        }

        return this.panels[index] ?? null;
    }
}

customElements.define('custom-tabs', CustomTabs);