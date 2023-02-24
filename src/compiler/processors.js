import {clone as _cloneDeep} from 'lodash-es'
import PromiseWorker from 'promise-worker';
import svelteWorker from './workers/worker?worker'
import {get} from 'svelte/store'
import {site} from '@primo-app/primo/stores/data/draft'
import {locale} from '@primo-app/primo/stores/app/misc'

import postCSSWorker from './workers/postcss.worker?worker'
const PostCSSWorker = new postCSSWorker
const cssPromiseWorker = new PromiseWorker(PostCSSWorker);

const SvelteWorker = new svelteWorker()
const htmlPromiseWorker = new PromiseWorker(SvelteWorker);

const componentsMap = new Map();

export async function html({ component, buildStatic = true, format = 'esm'}) {

  let cacheKey
  if (!buildStatic) {
    cacheKey = JSON.stringify({
      component,
      format
    })
    if (componentsMap.has(cacheKey)) {
      const cached = componentsMap.get(cacheKey)
      return cached
    }
  }

  let res
  try {
    const has_js = Array.isArray(component) ? component.some(s => s.js) : !!component.js
    res = await htmlPromiseWorker.postMessage({
      component,
      hydrated: buildStatic && has_js,
      buildStatic,
      format,
      site: get(site),
      locale: get(locale)
    })
  } catch(e) {
    console.log('error', e)
    res = {
      error: e.toString()
    }
  }

  let final 

  if (!res) {
    final = {
      html: '<h1 style="text-align: center">could not render</h1>'
    }
    res = {}
  } else if (res.error) {
    console.error(res.error)
    final = {
      error: escapeHtml(res.error)
    }
    function escapeHtml(unsafe) {
      return unsafe
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;")
           .replace(/'/g, "&#039;");
    }
  } else if (buildStatic) {   
    const blob = new Blob([res.ssr], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const {default:App} = await import(url/* @vite-ignore */)
    const rendered = App.render(component.data)
    final = {
      head: rendered.head,
      html: rendered.html,
      css: rendered.css.code,
      js: res.dom
    }
  } else {
    final = {
      js: res.dom
    }
  } 

  if (!buildStatic) {
    componentsMap.set(cacheKey, final)
  }

  return final
}


const cssMap = new Map()
export async function css(raw) {
  if (cssMap.has(raw)) {
    return ({ css: cssMap.get(raw) })
  }
  const processed = await cssPromiseWorker.postMessage({
    css: raw
  })
  if (processed.message) {
    return {
      error: processed.message
    }
  }
  cssMap.set(raw, processed)
  return {
    css: processed
  }
}