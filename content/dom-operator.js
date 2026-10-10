/**
 * DOM 操作封装
 * @module content/dom-operator
 */

import { SELECTORS, getSelector } from './selectors.js';
import { DEFAULT_TIMEOUT, POLL_INTERVAL } from '../shared/constants.js';

/**
 * 等待元素出现在 DOM 中
 * @param {string} selector - CSS 选择器（可以是逗号分隔的多个选择器）
 * @param {number} timeout - 超时时间（毫秒），默认 5000ms
 * @returns {Promise<Element>} 找到的 DOM 元素
 */
export async function waitForElement(selector, timeout = DEFAULT_TIMEOUT) {
  const startTime = Date.now();

  // 尝试多个选择器（逗号分隔）
  const selectors = selector.split(',').map(s => s.trim());

  while (Date.now() - startTime < timeout) {
    for (const sel of selectors) {
      const element = document.querySelector(sel);
      if (element && element.offsetParent !== null) {
        return element;
      }
    }
    await sleep(POLL_INTERVAL);
  }

  throw new Error(`等待元素超时 (selector=${selector}, timeout=${timeout}ms)`);
}

/**
 * 通过文本内容查找元素
 * @param {string} baseSelector - 基础 CSS 选择器
 * @param {string} text - 要匹配的文本内容
 * @param {boolean} exactMatch - 是否精确匹配（默认 false，模糊匹配）
 * @returns {Element|null} 找到的元素或 null
 */
export function findElementByText(baseSelector, text, exactMatch = false) {
  const elements = document.querySelectorAll(baseSelector);
  const searchText = text.toLowerCase();

  for (let el of elements) {
    const elText = el.textContent.trim().toLowerCase();
    if (exactMatch) {
      if (elText === searchText) return el;
    } else {
      if (elText.includes(searchText)) return el;
    }
  }

  return null;
}

/**
 * 安全地向输入框输入文本（兼容 Vue/React 双向绑定）
 * @param {object} options - 输入选项
 * @param {string} options.selector - CSS 选择器（可以是逗号分隔的多个选择器）
 * @param {string} options.text - 要输入的文本
 * @param {boolean} options.triggerEvents - 是否触发事件（默认 true）
 * @param {number} options.timeout - 超时时间（毫秒）
 * @returns {Promise<void>}
 */
export async function inputText({ selector, text, triggerEvents = true, timeout = DEFAULT_TIMEOUT }) {
  try {
    const element = await waitForElement(selector, timeout);

    // 聚焦元素
    element.focus();

    // 设置值
    element.value = text;

    // 触发事件以兼容 Vue/React 双向绑定
    if (triggerEvents) {
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 失去焦点
    element.blur();

    console.log(`[DOMOperator] 输入文本成功 (selector=${selector}, text=${text})`);
  } catch (error) {
    console.error(`[DOMOperator] 输入文本失败 (selector=${selector}):`, error);
    throw error;
  }
}

/**
 * 安全地点击元素
 * @param {string} selector - CSS 选择器（可以是逗号分隔的多个选择器）
 * @param {number} timeout - 超时时间（毫秒）
 * @param {string} [buttonText] - 可选：通过文本内容查找按钮
 * @returns {Promise<void>}
 */
export async function clickElement(selector, timeout = DEFAULT_TIMEOUT, buttonText = null) {
  try {
    let element;

    // 如果指定了 buttonText，先尝试通过文本查找
    if (buttonText) {
      element = findElementByText(selector, buttonText, false);
    }

    // 如果没找到，使用正常选择器查找
    if (!element) {
      element = await waitForElement(selector, timeout);
    }

    // 滚动到元素可见
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 等待一小段时间确保元素完全可见
    await sleep(100);

    // 触发鼠标事件
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    console.log(`[DOMOperator] 点击元素成功 (selector=${selector})`);
  } catch (error) {
    console.error(`[DOMOperator] 点击元素失败 (selector=${selector}):`, error);
    throw error;
  }
}

/**
 * 安全地在下拉框中选择选项
 * @param {string} selector - CSS 选择器
 * @param {string} value - 要选择的选项值
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<void>}
 */
export async function selectOption(selector, value, timeout = DEFAULT_TIMEOUT) {
  try {
    const element = await waitForElement(selector, timeout);

    // 设置选中值
    element.value = value;

    // 触发 change 事件
    element.dispatchEvent(new Event('change', { bubbles: true }));

    console.log(`[DOMOperator] 选择选项成功 (selector=${selector}, value=${value})`);
  } catch (error) {
    console.error(`[DOMOperator] 选择选项失败 (selector=${selector}):`, error);
    throw error;
  }
}

/**
 * 读取输入框的值
 * @param {string} selector - CSS 选择器（可以是逗号分隔的多个选择器）
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<string>} 输入框的值
 */
export async function getInputValue(selector, timeout = DEFAULT_TIMEOUT) {
  try {
    const element = await waitForElement(selector, timeout);
    return element.value || '';
  } catch (error) {
    console.error(`[DOMOperator] 读取输入值失败 (selector=${selector}):`, error);
    throw error;
  }
}

/**
 * 检查元素是否可见
 * @param {string} selector - CSS 选择器
 * @returns {boolean} 是否可见
 */
export function isElementVisible(selector) {
  const element = document.querySelector(selector);
  if (!element) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         element.offsetParent !== null;
}

/**
 * 延迟指定时间
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
