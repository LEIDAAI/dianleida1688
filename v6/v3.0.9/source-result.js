'use strict';

// Standalone iteration of the result DOM from the supplied saved web page.
// 件数 uses the product card's 月件数; 批发价 uses the displayed product price.
(() => {
  const page = document.querySelector('.source-result-page');
  const form = document.getElementById('resultRangeForm');
  const error = document.getElementById('resultFilterError');
  const cards = [...page.querySelectorAll('.result-product-card')];
  const selected = new Set();
  const ranges = { qtyMin: null, qtyMax: null, priceMin: null, priceMax: null };
  const numberFrom = text => Number(text.replace(/[^\d.-]/g, ''));
  const items = cards.map((card, index) => {
    const metrics = [...card.querySelectorAll('.result-data-cell')];
    const metric = label => metrics.find(cell => cell.querySelector('.result-data-label')?.textContent.trim() === label)?.querySelector('.result-data-value')?.textContent || '0';
    const item = {
      card, index,
      pieces: numberFrom(metric('月件数')),
      sales: numberFrom(metric('月销')),
      price: numberFrom(card.querySelector('.result-card-price').textContent),
      moq: numberFrom(card.querySelector('.result-card-moq').textContent),
      factory: !!card.querySelector('.result-store-type.factory'),
      freeShipping: /包邮/.test(card.querySelector('.result-card-ship-row').textContent),
      // No membership data is present in this snapshot; do not infer badges.
      memberTypes: [],
      title: card.querySelector('.result-title-text').textContent.trim(),
      url: card.querySelector('.result-product-title').href,
      store: card.querySelector('.result-store-name').textContent.trim()
    };
    const label = document.createElement('label');
    label.className = 'result-card-select';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('aria-label', '选择商品：' + item.title);
    label.append(input);
    card.querySelector('.result-card-img-wrap').append(label);
    input.addEventListener('change', () => {
      if (input.checked) selected.add(item); else selected.delete(item);
      syncSelection();
    });
    item.checkbox = input;
    return item;
  });
  const rows = [...page.querySelectorAll('.result-source-row')];
  const allCheckbox = page.querySelector('.result-toolbar-left > .el-checkbox input');
  const visibleItems = () => items.filter(item => !item.card.hidden);

  function syncSelection() {
    items.forEach(item => {
      item.checkbox.checked = selected.has(item);
      item.card.classList.toggle('selected', selected.has(item));
    });
    page.querySelector('.result-selected-count b').textContent = selected.size;
    const visible = visibleItems();
    const count = visible.filter(item => selected.has(item)).length;
    allCheckbox.checked = visible.length > 0 && count === visible.length;
    allCheckbox.indeterminate = count > 0 && count < visible.length;
    allCheckbox.disabled = visible.length === 0;
    rows.forEach(row => {
      const checkbox = row.querySelector('.result-source-checkbox input');
      const children = visible.filter(item => row.contains(item.card));
      const checked = children.filter(item => selected.has(item)).length;
      checkbox.checked = children.length > 0 && checked === children.length;
      checkbox.indeterminate = checked > 0 && checked < children.length;
    });
  }

  function applyFilters() {
    const checked = selector => [...page.querySelectorAll(selector + ':checked')].map(input => input.value);
    const trade = checked('.result-filter-panel .el-checkbox input');
    const company = page.querySelector('.result-filter-panel input[type="radio"]:checked')?.value || '';
    const member = trade.filter(value => ['sourceFlagship', 'superFactory', 'TrustPass'].includes(value));
    items.forEach(item => {
      const match =
        (ranges.qtyMin === null || item.pieces >= ranges.qtyMin) &&
        (ranges.qtyMax === null || item.pieces <= ranges.qtyMax) &&
        (ranges.priceMin === null || item.price >= ranges.priceMin) &&
        (ranges.priceMax === null || item.price <= ranges.priceMax) &&
        (!trade.includes('minOrderQuantity') || item.moq === 1) &&
        (!trade.includes('freeShipping') || item.freeShipping) &&
        (!company || (company === '2' ? item.factory : !item.factory)) &&
        member.every(value => item.memberTypes.includes(value));
      item.card.hidden = !match;
      if (!match) selected.delete(item);
    });
    const visible = visibleItems();
    rows.forEach(row => {
      row.hidden = !visible.some(item => row.contains(item.card));
    });
    document.getElementById('resultFilterEmpty').hidden = visible.length > 0;
    document.getElementById('resultPaginationTotal').textContent = `共 ${rows.filter(row => !row.hidden).length} 条搜索图片结果`;
    syncSelection();
  }

  function readRanges() {
    const specs = [
      ['qtyMin', 'resultQtyMin', '最小件数', true],
      ['qtyMax', 'resultQtyMax', '最大件数', true],
      ['priceMin', 'resultPriceMin', '最低批发价', false],
      ['priceMax', 'resultPriceMax', '最高批发价', false]
    ];
    const next = {};
    form.querySelectorAll('input').forEach(input => input.removeAttribute('aria-invalid'));
    error.hidden = true;
    for (const [key, id, label, integer] of specs) {
      const input = document.getElementById(id);
      const value = input.value.trim();
      const number = value === '' ? null : Number(value);
      if (input.validity.badInput || (number !== null && (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number)) || (!integer && Math.abs(number * 100 - Math.round(number * 100)) > 0.000001)))) {
        input.setAttribute('aria-invalid', 'true');
        error.textContent = label + (integer ? '请输入大于或等于 0 的整数' : '请输入大于或等于 0、最多两位小数的金额');
        error.hidden = false;
        return;
      }
      next[key] = number;
    }
    for (const [min, max, id, label] of [['qtyMin', 'qtyMax', 'resultQtyMax', '件数'], ['priceMin', 'priceMax', 'resultPriceMax', '批发价']]) {
      if (next[min] !== null && next[max] !== null && next[min] > next[max]) {
        const input = document.getElementById(id);
        input.setAttribute('aria-invalid', 'true');
        error.textContent = label + '的最小值不能大于最大值';
        error.hidden = false;
        return;
      }
    }
    Object.assign(ranges, next);
    applyFilters();
  }
  form.addEventListener('submit', event => { event.preventDefault(); readRanges(); });
  page.querySelectorAll('.result-filter-panel input').forEach(input => {
    if (input.type === 'radio') {
      input.name = 'resultCompany';
      input.checked = input.value === '';
      const label = input.closest('label');
      ['role', 'aria-checked', 'tabindex'].forEach(attribute => label.removeAttribute(attribute));
    }
    input.removeAttribute('aria-hidden');
    input.removeAttribute('tabindex');
    input.addEventListener('change', applyFilters);
  });

  function sortItems(value) {
    rows.forEach(row => {
      const parent = row.querySelector('.result-source-products');
      items.filter(item => parent.contains(item.card)).sort((a, b) => value === 'price' ? a.price - b.price || a.index - b.index : value === 'sales' ? b.pieces - a.pieces || a.index - b.index : a.index - b.index).forEach(item => parent.append(item.card));
    });
    page.querySelectorAll('.result-sort-option').forEach(label => {
      const input = label.querySelector('input');
      input.checked = input.value === value;
      label.classList.toggle('active', input.checked);
    });
  }
  page.querySelectorAll('.result-sort-option input').forEach(input => {
    input.name = 'resultSort';
    input.addEventListener('change', () => sortItems(input.value));
  });
  let rangeInputTimer;
  form.querySelectorAll('.result-range-panel input').forEach(input => {
    input.addEventListener('input', () => {
      clearTimeout(rangeInputTimer);
      rangeInputTimer = setTimeout(readRanges, 250);
    });
    input.addEventListener('change', () => {
      clearTimeout(rangeInputTimer);
      readRanges();
    });
  });
  allCheckbox.addEventListener('change', () => {
    visibleItems().forEach(item => { if (allCheckbox.checked) selected.add(item); else selected.delete(item); });
    syncSelection();
  });
  rows.forEach(row => row.querySelector('.result-source-checkbox input').addEventListener('change', event => {
    visibleItems().filter(item => row.contains(item.card)).forEach(item => { if (event.target.checked) selected.add(item); else selected.delete(item); });
    syncSelection();
  }));
  page.querySelector('.result-back-btn').addEventListener('click', () => { location.href = 'ai-three-step.html?page=list'; });
  page.querySelectorAll('.result-source-search-btn').forEach(button => button.addEventListener('click', () => {
    window.open('https://www.dianleida.net/1688/competeShop/category/imageSearchBatch/', '_blank', 'noopener');
  }));
  // All saved products fit in the responsive layout; don't show inactive carousel controls.
  page.querySelectorAll('.slide-button').forEach(button => { button.hidden = true; });
  page.querySelector('.result-toolbar-actions button').addEventListener('click', () => {
    const exported = selected.size ? [...selected] : visibleItems();
    if (!exported.length) return;
    const cell = value => '"' + String(value).replace(/"/g, '""').replace(/^[=+@-]/, "'$&") + '"';
    const csv = '\uFEFF' + [['商品名称', '月件数', '批发价（元）', '供应商', '商品链接'], ...exported.map(item => [item.title, item.pieces, item.price, item.store, item.url])].map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = '寻源结果.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  sortItems('match');
  applyFilters();
})();
