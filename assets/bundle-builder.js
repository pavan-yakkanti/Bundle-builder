class BundleBuilder extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.init();
  }

  init() {
    // All block elements
    this.blocks = Array.from(
      this.querySelectorAll('[data-block-index]')
    );

    // Dropdown icons
    this.dropdownIcons = Array.from(
      this.querySelectorAll('[data-block-dropdown-icon-index]')
    );

    // Next buttons
    this.nextButtons = Array.from(
      this.querySelectorAll('[data-block-next-button-index]')
    );

    this.addEventListeners();
  }

  addEventListeners() {
    // Dropdown click
    this.dropdownIcons.forEach((icon) => {
      icon.addEventListener('click', () => {
        const index = icon.getAttribute('data-block-dropdown-icon-index');
        this.toggleBlock(index);
      });
    });

    // Next button click
    this.nextButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const currentIndex = parseInt(
          button.getAttribute('data-block-next-button-index'),
          10
        );

        const nextIndex = currentIndex + 1;

        // Check if next block exists
        const nextBlockExists = this.blocks.some(
          (block) =>
            parseInt(block.getAttribute('data-block-index'), 10) === nextIndex
        );

        if (nextBlockExists) {
          this.openBlock(nextIndex);
        }
      });
    });
  }

  toggleBlock(index) {
    this.blocks.forEach((block) => {
      const blockIndex = block.getAttribute('data-block-index');

      if (blockIndex === index) {
        block.classList.toggle('is-open');
      } else {
        block.classList.remove('is-open');
      }
    });
  }

  openBlock(index) {
    this.blocks.forEach((block) => {
      const blockIndex = parseInt(
        block.getAttribute('data-block-index'),
        10
      );

      if (blockIndex === index) {
        block.classList.add('is-open');
        const productsContainer = block.querySelector('.bundle-builder__step-collection-container');

        if (productsContainer) {
          requestAnimationFrame(() => {
            const height = productsContainer.scrollHeight;
            productsContainer.style.height = height + "px";

            // Wait one more frame AFTER height is applied
            requestAnimationFrame(() => {
              block.scrollIntoView({
                behavior: "smooth",
                block: "start"
              });
            });
          });
        }
      } else {
        block.classList.remove('is-open');
      }
    });
  }
}
if (!customElements.get('bundle-builder')) {
  customElements.define('bundle-builder', BundleBuilder);
}

class BundleBuilderProductCard extends HTMLElement {
  constructor() {
    super();
    this.bundleData = this.getSessionData();
    this.quantity = 0;
  }

  connectedCallback() {
    this.productData = this.getProductJSON();

    this.blockIndex = this.productData.blockIndex;
    this.blockTitle = this.productData.blockTitle;

    this.productId = this.productData.productId;
    this.productHandle = this.productData.productHandle;
    this.productUrl = this.productData.productUrl;
    this.productImage = this.productData.productImage;

    this.variantsData = this.productData.variants;

    this.variantSwatches = Array.from(
      this.querySelectorAll('[data-variant-id]')
    );

    this.qtyInput = this.querySelector('[data-qty-input]');
    this.qtyPlus = this.querySelector('[data-qty-plus]');
    this.qtyMinus = this.querySelector('[data-qty-minus]');

    this.init();
    document.addEventListener(
      'bundle-builder-review:update',
      this.syncFromStorage.bind(this)
    );
  }

  getProductJSON() {
    const script = this.querySelector('[data-product-json]');
    return JSON.parse(script.textContent);
  }

  init() {
    if (this.variantsData.length > 0) {
      this.selectVariantById(this.variantsData[0].variantId);
    }

    this.attachEvents();
    this.updateQtyUI();
    this.updateBlockSelectedCount();
  }

  attachEvents() {
    this.variantSwatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        this.selectVariantById(swatch.dataset.variantId);
      });
    });

    this.qtyPlus.addEventListener('click', () => {
      this.updateQuantity(1);
    });

    this.qtyMinus.addEventListener('click', () => {
      this.updateQuantity(-1);
    });

    this.qtyInput.addEventListener('change', (e) => {
      this.quantity = parseInt(e.target.value) || 0;
      this.persist();
      this.updateQtyUI();
      this.updateBlockSelectedCount();
      this.dispatchBundleUpdate();
    });
  }

  updateProductCardPrice() {
    if (!this.currentVariant) return;

    const comparePrice =
      this.currentVariant.variantCompareAtPrice;
    const price =
      this.currentVariant.variantPrice;

    const saleContainer = this.querySelector(
      '.bundle-product-card__sale-price-container'
    );

    const compareEl = this.querySelector(
      '.bundle-product-card__compare-at-price'
    );

    const salePriceEl = this.querySelector(
      '.bundle-product-card__sale-price'
    );

    const normalContainer = this.querySelector(
      '.bundle-product-card__price-container'
    );

    const hasCompare =
      comparePrice &&
      comparePrice !== price;

    // CASE 1: Variant HAS compare price
    if (hasCompare) {
      if (saleContainer) {
        // Structure already exists → just update
        if (compareEl) compareEl.textContent = comparePrice;
        if (salePriceEl) salePriceEl.textContent = price;
      } else if (normalContainer) {
        // Switch from normal → sale structure
        normalContainer.outerHTML = `
          <span class="bundle-product-card__sale-price-container">
            <s class="price price--compare bundle-product-card__compare-at-price">
              ${comparePrice}
            </s>
            <span class="price price--sale bundle-product-card__sale-price">
              ${price}
            </span>
          </span>
        `;
      }
    }

    // CASE 2: Variant has NO compare price
    else {
      if (normalContainer) {
        normalContainer.textContent = price;
      } else if (saleContainer) {
        // Switch from sale → normal structure
        saleContainer.outerHTML = `
          <span class="price bundle-product-card__price-container">
            ${price}
          </span>
        `;
      }
    }
  }

  selectVariantById(variantId) {
    this.currentVariant = this.variantsData.find(
      (v) => String(v.variantId) === String(variantId)
    );

    if (!this.currentVariant) return;

    this.currentVariantId = this.currentVariant.variantId;

    this.variantSwatches.forEach((s) =>
      s.classList.remove('selected')
    );

    const activeSwatch = this.querySelector(
      `[data-variant-id="${variantId}"]`
    );

    if (activeSwatch) {
      activeSwatch.classList.add('selected');
    }

    const storedVariant = this.getStoredVariant(
      this.currentVariantId
    );

    this.quantity = storedVariant?.variantQuantity || 0;
    this.qtyInput.value = this.quantity;

    this.updateQtyUI();
    this.updateProductCardPrice();
    this.persist();
    this.updateBlockSelectedCount();
    this.dispatchBundleUpdate();
  }

  updateQuantity(value, absolute = false) {
    let newQty;

    if (absolute) {
      newQty = value;
    } else {
      newQty = this.quantity + value;
    }

    if (newQty < 0) newQty = 0;

    this.quantity = newQty;
    this.qtyInput.value = newQty;

    this.persist();
    this.updateQtyUI();
    this.updateBlockSelectedCount();
    this.dispatchBundleUpdate();
  }

  syncFromStorage() {
    this.bundleData = this.getSessionData();

    if (!this.currentVariantId) return;

    const storedVariant = this.getStoredVariant(
      this.currentVariantId
    );

    const storedQty = storedVariant?.variantQuantity || 0;

    if (storedQty !== this.quantity) {
      this.updateQuantity(storedQty, true); // absolute mode
    }
  }

  updateQtyUI() {
    this.qtyMinus.disabled = this.quantity === 0;

    if (this.quantity > 0) {
      this.classList.add('is-selected');
    } else {
      this.classList.remove('is-selected');
    }
  }

  persist() {
    if (!this.currentVariant) return;
    this.bundleData = this.getSessionData();
    let block = this.bundleData.find(
      (b) => b.blockIndex === this.blockIndex
    );

    if (!block) {
      block = {
        blockIndex: this.blockIndex,
        blockTitle: this.blockTitle,
        products: []
      };
      this.bundleData.push(block);
    }

    let product = block.products.find(
      (p) => p.productId === this.productId
    );

    if (!product) {
      product = {
        productId: this.productId,
        productHandle: this.productHandle,
        productUrl: this.productUrl,
        productImage: this.productImage,
        variants: []
      };
      block.products.push(product);
    }

    let variant = product.variants.find(
      (v) => v.variantId === this.currentVariantId
    );

    if (!variant) {
      variant = {
        variantId: this.currentVariantId
      };
      product.variants.push(variant);
    }

    variant.variantQuantity = this.quantity;
    variant.variantPrice = this.currentVariant.variantPrice;
    variant.variantPriceRaw = this.currentVariant.variantPriceRaw;
    variant.variantCompareAtPrice =
      this.currentVariant.variantCompareAtPrice;
    variant.variantCompareAtPriceRaw =
      this.currentVariant.variantCompareAtPriceRaw;
    variant.variantImage = this.currentVariant.variantImage;
    variant.variantUrl = this.currentVariant.variantUrl;
    variant.variantTitle = this.currentVariant.variantTitle;

    sessionStorage.setItem(
      'bundleBuilderData',
      JSON.stringify(this.bundleData)
    );

    console.log('Bundle Data:', this.bundleData);
  }

  updateBlockSelectedCount() {
    const updatedData = JSON.parse(
      sessionStorage.getItem('bundleBuilderData')
    ) || [];

    const block = updatedData.find(
      (b) => b.blockIndex === this.blockIndex
    );

    if (!block) return;

    const totalSelected = block.products.reduce((sum, product) => {
      const hasSelectedVariant = product.variants.some(
        (variant) => (variant.variantQuantity || 0) > 0
      );

      return sum + (hasSelectedVariant ? 1 : 0);
    }, 0);

    const countElement = document.querySelector(
      `.bundle-builder__selected-count[data-block-selected-count-index="${this.blockIndex}"]`
    );

    if (!countElement) return;

    if (totalSelected > 0) {
      countElement.textContent = `${totalSelected} selected`;
    } else {
      countElement.textContent = '';
    }
  }

  dispatchBundleUpdate() {
    this.dispatchEvent(
      new CustomEvent('bundle-builder:update', {
        bubbles: true,
        detail: {
          bundleData: this.bundleData
        }
      })
    );
  }

  getStoredVariant(variantId) {
    const block = this.bundleData.find(
      (b) => b.blockIndex === this.blockIndex
    );

    const product = block?.products.find(
      (p) => p.productId === this.productId
    );

    return product?.variants.find(
      (v) => v.variantId === variantId
    );
  }

  getSessionData() {
    return (
      JSON.parse(
        sessionStorage.getItem('bundleBuilderData')
      ) || []
    );
  }
}

if (!customElements.get('bundle-builder-product-card')) {
  customElements.define(
    'bundle-builder-product-card',
    BundleBuilderProductCard
  );
}

class BundleBuilderReview extends HTMLElement {
  constructor() {
    super();
    this.container = null;
  }

  connectedCallback() {
    this.container = this.querySelector(
      '.bundle-builder__review-selected-products-list'
    );

    this.render();

    document.addEventListener(
      'bundle-builder:update',
      () => this.render()
    );
  }

  getData() {
    return (
      JSON.parse(
        sessionStorage.getItem('bundleBuilderData')
      ) || []
    );
  }

  render() {
    if (!this.container) return;

    const data = this.getData();

    this.container.innerHTML = '';

    data.forEach((block) => {
      const selectedVariants = block.products.flatMap((product) =>
        product.variants
          .filter((v) => v.variantQuantity > 0)
          .map((variant) => ({
            ...variant,
            productTitle: product.productHandle,
            productImage: product.productImage
          }))
      );

      if (selectedVariants.length === 0) return;
      console.log('selectedVariants', selectedVariants);
      const hiddenElementSelectors = [
        '.bundle-builder__review-shipping',
        '.bundle-builder__review-bottom'
      ];

      hiddenElementSelectors.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.classList.remove('bundle-builder__hide');
      });

      // Block container
      const blockWrapper = document.createElement('div');
      blockWrapper.className = 'bundle-review__block';

      // Block title
      const blockTitle = document.createElement('h3');
      blockTitle.className = 'bundle-review__block-title';
      blockTitle.textContent = block.blockTitle;
      blockWrapper.appendChild(blockTitle);

      selectedVariants.forEach((variant) => {
        const item = this.createVariantRow(block, variant);
        blockWrapper.appendChild(item);
      });

      this.container.appendChild(blockWrapper);
    });
    this.updateReviewTotals();
  }

  createVariantRow(block, variant) {
    const row = document.createElement('div');
    row.className = 'bundle-review__item';

    // Image
    const img = document.createElement('img');
    img.className = 'bundle-review__image';
    img.src = variant.variantImage || variant.productImage;

    // Info container
    const info = document.createElement('div');
    info.className = 'bundle-review__info';

    const title = document.createElement('div');
    title.className = 'bundle-review__product-title';
    title.textContent = variant.productTitle;

    const variantTitle = document.createElement('div');
    variantTitle.className = 'bundle-review__variant-title';
    variantTitle.textContent = variant.variantTitle;

    info.appendChild(title);
    info.appendChild(variantTitle);

    // Right container
    const right = document.createElement('div');
    right.className = 'bundle-review__right';

    // Quantity Selector
    const qtyWrapper = document.createElement('div');
    qtyWrapper.className = 'bundle-review__qty';

    const minus = document.createElement('button');
    minus.textContent = '-';

    const input = document.createElement('input');
    input.type = 'number';
    input.value = variant.variantQuantity;
    input.min = 0;

    const plus = document.createElement('button');
    plus.textContent = '+';

    minus.disabled = variant.variantQuantity === 0;

    plus.addEventListener('click', () => {
      this.updateQuantity(
        block.blockIndex,
        variant.variantId,
        1
      );
    });

    minus.addEventListener('click', () => {
      this.updateQuantity(
        block.blockIndex,
        variant.variantId,
        -1
      );
    });

    input.addEventListener('change', (e) => {
      const value = parseInt(e.target.value) || 0;
      this.setQuantity(
        block.blockIndex,
        variant.variantId,
        value
      );
    });

    qtyWrapper.appendChild(minus);
    qtyWrapper.appendChild(input);
    qtyWrapper.appendChild(plus);

    // Price container
    const priceWrapper = document.createElement('div');
    priceWrapper.className = 'bundle-review__price';

    if (variant.variantCompareAtPrice) {
      const compare = document.createElement('div');
      compare.className = 'bundle-review__compare-price';
      compare.textContent = variant.variantCompareAtPrice;
      priceWrapper.appendChild(compare);
    }

    const price = document.createElement('div');
    price.className = 'bundle-review__sale-price';
    price.textContent = variant.variantPrice;

    priceWrapper.appendChild(price);

    right.appendChild(qtyWrapper);
    right.appendChild(priceWrapper);

    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(right);

    return row;
  }

  updateQuantity(blockIndex, variantId, change) {
    const data = this.getData();

    const block = data.find((b) => b.blockIndex === blockIndex);
    if (!block) return;

    block.products.forEach((product) => {
      product.variants.forEach((variant) => {
        if (variant.variantId === variantId) {
          variant.variantQuantity += change;
          if (variant.variantQuantity < 0)
            variant.variantQuantity = 0;
        }
      });
    });

    sessionStorage.setItem(
      'bundleBuilderData',
      JSON.stringify(data)
    );

    document.dispatchEvent(
      new CustomEvent('bundle-builder-review:update', {
        bubbles: true
      })
    );

    document.dispatchEvent(
      new CustomEvent('bundle-builder:update', {
        bubbles: true
      })
    );
  }

  updateReviewTotals() {
    const bundleData = JSON.parse(
      sessionStorage.getItem('bundleBuilderData')
    ) || [];

    const subtotalEl = this.querySelector('.bundle-builder__review-subtotal-price');
    const totalEl = this.querySelector('.bundle-builder__review-total-price');
    const savingsEl = this.querySelector('.bundle-builder__review-savings-text');

    if (!totalEl) return;

    let totalPriceRaw = 0;
    let totalCompareRaw = 0;

    bundleData.forEach((block) => {
      block.products.forEach((product) => {
        product.variants.forEach((variant) => {
          const qty = variant.variantQuantity || 0;

          if (qty > 0) {
            totalPriceRaw += (variant.variantPriceRaw || 0) * qty;
            totalCompareRaw += (variant.variantCompareAtPriceRaw || 0) * qty;
          }
        });
      });
    });

    const formatMoney = (amount) => `$${amount.toFixed(2)}`;

    totalEl.textContent = formatMoney(totalPriceRaw / 100);

    if (subtotalEl) {
      if (totalCompareRaw > 0) {
        subtotalEl.textContent = formatMoney(totalCompareRaw / 100);
        subtotalEl.style.display = '';
      } else {
        subtotalEl.textContent = '';
        subtotalEl.style.display = 'none';
      }
    }

    if (savingsEl) {
      const savingsRaw = totalCompareRaw;

      if (savingsRaw > 0) {
        savingsEl.textContent =
          `Congrats! You’re saving ${formatMoney(savingsRaw / 100)} on your security bundle!`;
        savingsEl.style.display = '';
      } else {
        savingsEl.textContent = '';
        savingsEl.style.display = 'none';
      }
    }
  }

  setQuantity(blockIndex, variantId, quantity) {
    const data = this.getData();

    const block = data.find((b) => b.blockIndex === blockIndex);
    if (!block) return;

    block.products.forEach((product) => {
      product.variants.forEach((variant) => {
        if (variant.variantId === variantId) {
          variant.variantQuantity = quantity;
        }
      });
    });

    sessionStorage.setItem(
      'bundleBuilderData',
      JSON.stringify(data)
    );

    document.dispatchEvent(
      new CustomEvent('bundle-builder-review:update', {
        bubbles: true
      })
    );

    document.dispatchEvent(
      new CustomEvent('bundle-builder:update', {
        bubbles: true
      })
    );
  }
}
if (!customElements.get('bundle-builder-review')) {
  customElements.define(
    'bundle-builder-review',
    BundleBuilderReview
  );
}