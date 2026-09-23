var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i7 = decorators.length - 1, decorator; i7 >= 0; i7--)
    if (decorator = decorators[i7])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// @lit-labs/ssr-dom-shim/lib/element-internals.js
var ElementInternalsShim = class ElementInternals {
  get shadowRoot() {
    return this.__host.__shadowRoot;
  }
  constructor(_host) {
    this.ariaActiveDescendantElement = null;
    this.ariaAtomic = "";
    this.ariaAutoComplete = "";
    this.ariaBrailleLabel = "";
    this.ariaBrailleRoleDescription = "";
    this.ariaBusy = "";
    this.ariaChecked = "";
    this.ariaColCount = "";
    this.ariaColIndex = "";
    this.ariaColIndexText = "";
    this.ariaColSpan = "";
    this.ariaControlsElements = null;
    this.ariaCurrent = "";
    this.ariaDescribedByElements = null;
    this.ariaDescription = "";
    this.ariaDetailsElements = null;
    this.ariaDisabled = "";
    this.ariaErrorMessageElements = null;
    this.ariaExpanded = "";
    this.ariaFlowToElements = null;
    this.ariaHasPopup = "";
    this.ariaHidden = "";
    this.ariaInvalid = "";
    this.ariaKeyShortcuts = "";
    this.ariaLabel = "";
    this.ariaLabelledByElements = null;
    this.ariaLevel = "";
    this.ariaLive = "";
    this.ariaModal = "";
    this.ariaMultiLine = "";
    this.ariaMultiSelectable = "";
    this.ariaOrientation = "";
    this.ariaOwnsElements = null;
    this.ariaPlaceholder = "";
    this.ariaPosInSet = "";
    this.ariaPressed = "";
    this.ariaReadOnly = "";
    this.ariaRelevant = "";
    this.ariaRequired = "";
    this.ariaRoleDescription = "";
    this.ariaRowCount = "";
    this.ariaRowIndex = "";
    this.ariaRowIndexText = "";
    this.ariaRowSpan = "";
    this.ariaSelected = "";
    this.ariaSetSize = "";
    this.ariaSort = "";
    this.ariaValueMax = "";
    this.ariaValueMin = "";
    this.ariaValueNow = "";
    this.ariaValueText = "";
    this.role = "";
    this.form = null;
    this.labels = [];
    this.states = /* @__PURE__ */ new Set();
    this.validationMessage = "";
    this.validity = {};
    this.willValidate = true;
    this.__host = _host;
  }
  checkValidity() {
    console.warn("`ElementInternals.checkValidity()` was called on the server.This method always returns true.");
    return true;
  }
  reportValidity() {
    return true;
  }
  setFormValue() {
  }
  setValidity() {
  }
};

// @lit-labs/ssr-dom-shim/lib/events.js
var __classPrivateFieldSet = function(receiver, state, value, kind, f3) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f3 : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f3.call(receiver, value) : f3 ? f3.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet = function(receiver, state, kind, f3) {
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f3 : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f3 : kind === "a" ? f3.call(receiver) : f3 ? f3.value : state.get(receiver);
};
var _Event_cancelable;
var _Event_bubbles;
var _Event_composed;
var _Event_defaultPrevented;
var _Event_timestamp;
var _Event_propagationStopped;
var _Event_type;
var _Event_target;
var _Event_isBeingDispatched;
var _a;
var _CustomEvent_detail;
var _b;
var NONE = 0;
var CAPTURING_PHASE = 1;
var AT_TARGET = 2;
var BUBBLING_PHASE = 3;
var enumerableProperty = { __proto__: null };
enumerableProperty.enumerable = true;
Object.freeze(enumerableProperty);
var EventShim = (_a = class Event {
  constructor(type, options = {}) {
    _Event_cancelable.set(this, false);
    _Event_bubbles.set(this, false);
    _Event_composed.set(this, false);
    _Event_defaultPrevented.set(this, false);
    _Event_timestamp.set(this, Date.now());
    _Event_propagationStopped.set(this, false);
    _Event_type.set(this, void 0);
    _Event_target.set(this, void 0);
    _Event_isBeingDispatched.set(this, void 0);
    this.NONE = NONE;
    this.CAPTURING_PHASE = CAPTURING_PHASE;
    this.AT_TARGET = AT_TARGET;
    this.BUBBLING_PHASE = BUBBLING_PHASE;
    if (arguments.length === 0)
      throw new Error(`The type argument must be specified`);
    if (typeof options !== "object" || !options) {
      throw new Error(`The "options" argument must be an object`);
    }
    const { bubbles, cancelable, composed } = options;
    __classPrivateFieldSet(this, _Event_cancelable, !!cancelable, "f");
    __classPrivateFieldSet(this, _Event_bubbles, !!bubbles, "f");
    __classPrivateFieldSet(this, _Event_composed, !!composed, "f");
    __classPrivateFieldSet(this, _Event_type, `${type}`, "f");
    __classPrivateFieldSet(this, _Event_target, null, "f");
    __classPrivateFieldSet(this, _Event_isBeingDispatched, false, "f");
  }
  initEvent(_type, _bubbles, _cancelable) {
    throw new Error("Method not implemented.");
  }
  stopImmediatePropagation() {
    this.stopPropagation();
  }
  preventDefault() {
    __classPrivateFieldSet(this, _Event_defaultPrevented, true, "f");
  }
  get target() {
    return __classPrivateFieldGet(this, _Event_target, "f");
  }
  get currentTarget() {
    return __classPrivateFieldGet(this, _Event_target, "f");
  }
  get srcElement() {
    return __classPrivateFieldGet(this, _Event_target, "f");
  }
  get type() {
    return __classPrivateFieldGet(this, _Event_type, "f");
  }
  get cancelable() {
    return __classPrivateFieldGet(this, _Event_cancelable, "f");
  }
  get defaultPrevented() {
    return __classPrivateFieldGet(this, _Event_cancelable, "f") && __classPrivateFieldGet(this, _Event_defaultPrevented, "f");
  }
  get timeStamp() {
    return __classPrivateFieldGet(this, _Event_timestamp, "f");
  }
  composedPath() {
    return __classPrivateFieldGet(this, _Event_isBeingDispatched, "f") ? [__classPrivateFieldGet(this, _Event_target, "f")] : [];
  }
  get returnValue() {
    return !__classPrivateFieldGet(this, _Event_cancelable, "f") || !__classPrivateFieldGet(this, _Event_defaultPrevented, "f");
  }
  get bubbles() {
    return __classPrivateFieldGet(this, _Event_bubbles, "f");
  }
  get composed() {
    return __classPrivateFieldGet(this, _Event_composed, "f");
  }
  get eventPhase() {
    return __classPrivateFieldGet(this, _Event_isBeingDispatched, "f") ? _a.AT_TARGET : _a.NONE;
  }
  get cancelBubble() {
    return __classPrivateFieldGet(this, _Event_propagationStopped, "f");
  }
  set cancelBubble(value) {
    if (value) {
      __classPrivateFieldSet(this, _Event_propagationStopped, true, "f");
    }
  }
  stopPropagation() {
    __classPrivateFieldSet(this, _Event_propagationStopped, true, "f");
  }
  get isTrusted() {
    return false;
  }
}, _Event_cancelable = /* @__PURE__ */ new WeakMap(), _Event_bubbles = /* @__PURE__ */ new WeakMap(), _Event_composed = /* @__PURE__ */ new WeakMap(), _Event_defaultPrevented = /* @__PURE__ */ new WeakMap(), _Event_timestamp = /* @__PURE__ */ new WeakMap(), _Event_propagationStopped = /* @__PURE__ */ new WeakMap(), _Event_type = /* @__PURE__ */ new WeakMap(), _Event_target = /* @__PURE__ */ new WeakMap(), _Event_isBeingDispatched = /* @__PURE__ */ new WeakMap(), _a.NONE = NONE, _a.CAPTURING_PHASE = CAPTURING_PHASE, _a.AT_TARGET = AT_TARGET, _a.BUBBLING_PHASE = BUBBLING_PHASE, _a);
Object.defineProperties(EventShim.prototype, {
  initEvent: enumerableProperty,
  stopImmediatePropagation: enumerableProperty,
  preventDefault: enumerableProperty,
  target: enumerableProperty,
  currentTarget: enumerableProperty,
  srcElement: enumerableProperty,
  type: enumerableProperty,
  cancelable: enumerableProperty,
  defaultPrevented: enumerableProperty,
  timeStamp: enumerableProperty,
  composedPath: enumerableProperty,
  returnValue: enumerableProperty,
  bubbles: enumerableProperty,
  composed: enumerableProperty,
  eventPhase: enumerableProperty,
  cancelBubble: enumerableProperty,
  stopPropagation: enumerableProperty,
  isTrusted: enumerableProperty
});
var CustomEventShim = (_b = class CustomEvent2 extends EventShim {
  constructor(type, options = {}) {
    super(type, options);
    _CustomEvent_detail.set(this, void 0);
    __classPrivateFieldSet(this, _CustomEvent_detail, options?.detail ?? null, "f");
  }
  initCustomEvent(_type, _bubbles, _cancelable, _detail) {
    throw new Error("Method not implemented.");
  }
  get detail() {
    return __classPrivateFieldGet(this, _CustomEvent_detail, "f");
  }
}, _CustomEvent_detail = /* @__PURE__ */ new WeakMap(), _b);
Object.defineProperties(CustomEventShim.prototype, {
  detail: enumerableProperty
});
var EventShimWithRealType = EventShim;
var CustomEventShimWithRealType = CustomEventShim;

// @lit-labs/ssr-dom-shim/lib/css.js
var _a2;
var CSSRuleShim = (_a2 = class CSSRule {
  constructor() {
    this.STYLE_RULE = 1;
    this.CHARSET_RULE = 2;
    this.IMPORT_RULE = 3;
    this.MEDIA_RULE = 4;
    this.FONT_FACE_RULE = 5;
    this.PAGE_RULE = 6;
    this.NAMESPACE_RULE = 10;
    this.KEYFRAMES_RULE = 7;
    this.KEYFRAME_RULE = 8;
    this.SUPPORTS_RULE = 12;
    this.COUNTER_STYLE_RULE = 11;
    this.FONT_FEATURE_VALUES_RULE = 14;
    this.MARGIN_RULE = 9;
    this.__parentStyleSheet = null;
    this.cssText = "";
  }
  get parentRule() {
    return null;
  }
  get parentStyleSheet() {
    return this.__parentStyleSheet;
  }
  get type() {
    return 0;
  }
}, _a2.STYLE_RULE = 1, _a2.CHARSET_RULE = 2, _a2.IMPORT_RULE = 3, _a2.MEDIA_RULE = 4, _a2.FONT_FACE_RULE = 5, _a2.PAGE_RULE = 6, _a2.NAMESPACE_RULE = 10, _a2.KEYFRAMES_RULE = 7, _a2.KEYFRAME_RULE = 8, _a2.SUPPORTS_RULE = 12, _a2.COUNTER_STYLE_RULE = 11, _a2.FONT_FEATURE_VALUES_RULE = 14, _a2.MARGIN_RULE = 9, _a2);

// @lit-labs/ssr-dom-shim/index.js
globalThis.Event ??= EventShimWithRealType;
globalThis.CustomEvent ??= CustomEventShimWithRealType;
var constructionToken = Symbol();
var isCaptureEventListener = (options) => typeof options === "boolean" ? options : options?.capture ?? false;
var enumerableProperty2 = { __proto__: null };
enumerableProperty2.enumerable = true;
Object.freeze(enumerableProperty2);
var EventTarget = class {
  constructor() {
    this.__eventListeners = /* @__PURE__ */ new Map();
    this.__captureEventListeners = /* @__PURE__ */ new Map();
  }
  addEventListener(type, callback, options) {
    if (callback === void 0 || callback === null) {
      return;
    }
    const eventListenersMap = isCaptureEventListener(options) ? this.__captureEventListeners : this.__eventListeners;
    let eventListeners = eventListenersMap.get(type);
    if (eventListeners === void 0) {
      eventListeners = /* @__PURE__ */ new Map();
      eventListenersMap.set(type, eventListeners);
    } else if (eventListeners.has(callback)) {
      return;
    }
    const normalizedOptions = typeof options === "object" && options ? options : {};
    normalizedOptions.signal?.addEventListener("abort", () => this.removeEventListener(type, callback, options));
    eventListeners.set(callback, normalizedOptions ?? {});
  }
  removeEventListener(type, callback, options) {
    if (callback === void 0 || callback === null) {
      return;
    }
    const eventListenersMap = isCaptureEventListener(options) ? this.__captureEventListeners : this.__eventListeners;
    const eventListeners = eventListenersMap.get(type);
    if (eventListeners !== void 0) {
      eventListeners.delete(callback);
      if (!eventListeners.size) {
        eventListenersMap.delete(type);
      }
    }
  }
  dispatchEvent(event) {
    let composedPath = this.__resolveFullEventPath();
    if (!event.composed && this.__host) {
      composedPath = composedPath.slice(0, composedPath.indexOf(this.__host));
    }
    let stopPropagation = false;
    let stopImmediatePropagation = false;
    let eventPhase = EventShimWithRealType.NONE;
    let target = null;
    let tmpTarget = null;
    let currentTarget = null;
    const originalStopPropagation = event.stopPropagation;
    const originalStopImmediatePropagation = event.stopImmediatePropagation;
    Object.defineProperties(event, {
      target: {
        get() {
          return target ?? tmpTarget;
        },
        ...enumerableProperty2
      },
      srcElement: {
        get() {
          return event.target;
        },
        ...enumerableProperty2
      },
      currentTarget: {
        get() {
          return currentTarget;
        },
        ...enumerableProperty2
      },
      eventPhase: {
        get() {
          return eventPhase;
        },
        ...enumerableProperty2
      },
      composedPath: {
        value: () => composedPath,
        ...enumerableProperty2
      },
      stopPropagation: {
        value: () => {
          stopPropagation = true;
          originalStopPropagation.call(event);
        },
        ...enumerableProperty2
      },
      stopImmediatePropagation: {
        value: () => {
          stopImmediatePropagation = true;
          originalStopImmediatePropagation.call(event);
        },
        ...enumerableProperty2
      }
    });
    const invokeEventListener = (listener, options, eventListenerMap) => {
      if (typeof listener === "function") {
        listener(event);
      } else if (typeof listener?.handleEvent === "function") {
        listener.handleEvent(event);
      }
      if (options.once) {
        eventListenerMap.delete(listener);
      }
    };
    const finishDispatch = () => {
      currentTarget = null;
      eventPhase = EventShimWithRealType.NONE;
      return !event.defaultPrevented;
    };
    const captureEventPath = composedPath.slice().reverse();
    target = !this.__host || !event.composed ? this : null;
    const retarget = (eventTargets) => {
      tmpTarget = this;
      while (tmpTarget.__host && eventTargets.includes(tmpTarget.__host)) {
        tmpTarget = tmpTarget.__host;
      }
    };
    for (const eventTarget of captureEventPath) {
      if (!target && (!tmpTarget || tmpTarget === eventTarget.__host)) {
        retarget(captureEventPath.slice(captureEventPath.indexOf(eventTarget)));
      }
      currentTarget = eventTarget;
      eventPhase = eventTarget === event.target ? EventShimWithRealType.AT_TARGET : EventShimWithRealType.CAPTURING_PHASE;
      const captureEventListeners = eventTarget.__captureEventListeners.get(event.type);
      if (captureEventListeners) {
        for (const [listener, options] of captureEventListeners) {
          invokeEventListener(listener, options, captureEventListeners);
          if (stopImmediatePropagation) {
            return finishDispatch();
          }
        }
      }
      if (stopPropagation) {
        return finishDispatch();
      }
    }
    const bubbleEventPath = event.bubbles ? composedPath : [this];
    tmpTarget = null;
    for (const eventTarget of bubbleEventPath) {
      if (!target && (!tmpTarget || eventTarget === tmpTarget.__host)) {
        retarget(bubbleEventPath.slice(0, bubbleEventPath.indexOf(eventTarget) + 1));
      }
      currentTarget = eventTarget;
      eventPhase = eventTarget === event.target ? EventShimWithRealType.AT_TARGET : EventShimWithRealType.BUBBLING_PHASE;
      const eventListeners = eventTarget.__eventListeners.get(event.type);
      if (eventListeners) {
        for (const [listener, options] of eventListeners) {
          invokeEventListener(listener, options, eventListeners);
          if (stopImmediatePropagation) {
            return finishDispatch();
          }
        }
      }
      if (stopPropagation) {
        return finishDispatch();
      }
    }
    return finishDispatch();
  }
  __resolveFullEventPath() {
    if (this.__eventPathCache) {
      return this.__eventPathCache;
    } else if (!this.__eventTargetParent) {
      return this.__eventPathCache = [this, documentShim, windowShim];
    } else {
      return this.__eventPathCache = [
        this,
        ...this.__eventTargetParent.__resolveFullEventPath()
      ];
    }
  }
};
var attributes = /* @__PURE__ */ new WeakMap();
var attributesForElement = (element) => {
  let attrs = attributes.get(element);
  if (attrs === void 0) {
    attributes.set(element, attrs = /* @__PURE__ */ new Map());
  }
  return attrs;
};
var NodeShim = class Node2 extends EventTarget {
  getRootNode(options) {
    if (options?.composed) {
      return document2;
    }
    const host = this.__host;
    return host?.__shadowRoot ?? document2;
  }
};
var DocumentShim = class Document2 extends NodeShim {
  get adoptedStyleSheets() {
    return [];
  }
  createTreeWalker() {
    return {};
  }
  createTextNode() {
    return {};
  }
  createElement() {
    return {};
  }
};
var documentShim = new DocumentShim();
var document2 = documentShim;
var WindowShim = class Window extends NodeShim {
  constructor(token) {
    super();
    if (token !== constructionToken) {
      throw new TypeError("Illegal constructor");
    }
    Object.assign(this, globalThis, {
      CustomElementRegistry,
      customElements: customElements2,
      document: document2,
      Document: DocumentShim,
      Element: ElementShim,
      EventTarget,
      HTMLElement: HTMLElementShim,
      Node: NodeShim,
      ShadowRoot: ShadowRootShim,
      window: this,
      Window: WindowShim
    });
  }
};
var ElementShim = class Element extends NodeShim {
  constructor() {
    super(...arguments);
    this.__shadowRootMode = null;
    this.__shadowRoot = null;
    this.__internals = null;
  }
  get attributes() {
    return Array.from(attributesForElement(this)).map(([name, value]) => ({
      name,
      value
    }));
  }
  get shadowRoot() {
    if (this.__shadowRootMode === "closed") {
      return null;
    }
    return this.__shadowRoot;
  }
  get localName() {
    return this.constructor.__localName;
  }
  get tagName() {
    return this.localName?.toUpperCase();
  }
  setAttribute(name, value) {
    attributesForElement(this).set(name, String(value));
  }
  removeAttribute(name) {
    attributesForElement(this).delete(name);
  }
  toggleAttribute(name, force) {
    if (this.hasAttribute(name)) {
      if (force === void 0 || !force) {
        this.removeAttribute(name);
        return false;
      }
    } else {
      if (force === void 0 || force) {
        this.setAttribute(name, "");
        return true;
      } else {
        return false;
      }
    }
    return true;
  }
  hasAttribute(name) {
    return attributesForElement(this).has(name);
  }
  attachShadow(init) {
    this.__shadowRootMode = init.mode;
    const shadowRoot = new ShadowRootShim(constructionToken, init);
    shadowRoot.__eventTargetParent = this;
    shadowRoot.__host = this;
    return this.__shadowRoot = shadowRoot;
  }
  attachInternals() {
    if (this.__internals !== null) {
      throw new Error(`Failed to execute 'attachInternals' on 'HTMLElement': ElementInternals for the specified element was already attached.`);
    }
    const internals = new ElementInternalsShim(this);
    this.__internals = internals;
    return internals;
  }
  getAttribute(name) {
    const value = attributesForElement(this).get(name);
    return value ?? null;
  }
};
var HTMLElementShim = class HTMLElement extends ElementShim {
};
var HTMLElementShimWithRealType = HTMLElementShim;
var ShadowRootShim = class ShadowRoot extends NodeShim {
  get host() {
    return this.__host;
  }
  constructor(constructionToken2, init) {
    super();
    if (constructionToken2 !== constructionToken2) {
      throw new TypeError("Illegal constructor");
    }
    this.mode = init.mode;
  }
};
globalThis.litServerRoot ??= Object.defineProperty(new HTMLElementShimWithRealType(), "localName", {
  // Patch localName (and tagName) to return a unique name.
  get() {
    return "lit-server-root";
  }
});
function promiseWithResolvers() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
var CustomElementRegistry = class {
  constructor() {
    this.__definitions = /* @__PURE__ */ new Map();
    this.__reverseDefinitions = /* @__PURE__ */ new Map();
    this.__pendingWhenDefineds = /* @__PURE__ */ new Map();
  }
  define(name, ctor) {
    if (this.__definitions.has(name)) {
      if (true) {
        console.warn(`'CustomElementRegistry' already has "${name}" defined. This may have been caused by live reload or hot module replacement in which case it can be safely ignored.
Make sure to test your application with a production build as repeat registrations will throw in production.`);
      } else {
        throw new Error(`Failed to execute 'define' on 'CustomElementRegistry': the name "${name}" has already been used with this registry`);
      }
    }
    if (this.__reverseDefinitions.has(ctor)) {
      throw new Error(`Failed to execute 'define' on 'CustomElementRegistry': the constructor has already been used with this registry for the tag name ${this.__reverseDefinitions.get(ctor)}`);
    }
    ctor.__localName = name;
    this.__definitions.set(name, {
      ctor,
      // Note it's important we read `observedAttributes` in case it is a getter
      // with side-effects, as is the case in Lit, where it triggers class
      // finalization.
      //
      // TODO(aomarks) To be spec compliant, we should also capture the
      // registration-time lifecycle methods like `connectedCallback`. For them
      // to be actually accessible to e.g. the Lit SSR element renderer, though,
      // we'd need to introduce a new API for accessing them (since `get` only
      // returns the constructor).
      observedAttributes: ctor.observedAttributes ?? []
    });
    this.__reverseDefinitions.set(ctor, name);
    this.__pendingWhenDefineds.get(name)?.resolve(ctor);
    this.__pendingWhenDefineds.delete(name);
  }
  get(name) {
    const definition = this.__definitions.get(name);
    return definition?.ctor;
  }
  getName(ctor) {
    return this.__reverseDefinitions.get(ctor) ?? null;
  }
  initialize(_root) {
    throw new Error(`customElements.initialize is not currently supported in SSR. Please file a bug if you need it.`);
  }
  upgrade(_element) {
    throw new Error(`customElements.upgrade is not currently supported in SSR. Please file a bug if you need it.`);
  }
  async whenDefined(name) {
    const definition = this.__definitions.get(name);
    if (definition) {
      return definition.ctor;
    }
    let withResolvers = this.__pendingWhenDefineds.get(name);
    if (!withResolvers) {
      withResolvers = promiseWithResolvers();
      this.__pendingWhenDefineds.set(name, withResolvers);
    }
    return withResolvers.promise;
  }
};
var CustomElementRegistryShimWithRealType = CustomElementRegistry;
var customElements2 = new CustomElementRegistryShimWithRealType();
var windowShim = new WindowShim(constructionToken);

// @lit/reactive-element/node/css-tag.js
var t = globalThis;
var e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s = Symbol();
var o = /* @__PURE__ */ new WeakMap();
var n = class {
  constructor(t7, e5, o7) {
    if (this._$cssResult$ = true, o7 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t7, this.t = e5;
  }
  get styleSheet() {
    let t7 = this.o;
    const s5 = this.t;
    if (e && void 0 === t7) {
      const e5 = void 0 !== s5 && 1 === s5.length;
      e5 && (t7 = o.get(s5)), void 0 === t7 && ((this.o = t7 = new CSSStyleSheet()).replaceSync(this.cssText), e5 && o.set(s5, t7));
    }
    return t7;
  }
  toString() {
    return this.cssText;
  }
};
var r = (t7) => new n("string" == typeof t7 ? t7 : t7 + "", void 0, s);
var i = (t7, ...e5) => {
  const o7 = 1 === t7.length ? t7[0] : e5.reduce((e6, s5, o8) => e6 + ((t8) => {
    if (true === t8._$cssResult$) return t8.cssText;
    if ("number" == typeof t8) return t8;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + t8 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s5) + t7[o8 + 1], t7[0]);
  return new n(o7, t7, s);
};
var S = (s5, o7) => {
  if (e) s5.adoptedStyleSheets = o7.map((t7) => t7 instanceof CSSStyleSheet ? t7 : t7.styleSheet);
  else for (const e5 of o7) {
    const o8 = document.createElement("style"), n6 = t.litNonce;
    void 0 !== n6 && o8.setAttribute("nonce", n6), o8.textContent = e5.cssText, s5.appendChild(o8);
  }
};
var c = e || void 0 === t.CSSStyleSheet ? (t7) => t7 : (t7) => t7 instanceof CSSStyleSheet ? ((t8) => {
  let e5 = "";
  for (const s5 of t8.cssRules) e5 += s5.cssText;
  return r(e5);
})(t7) : t7;

// @lit/reactive-element/node/reactive-element.js
var { is: h, defineProperty: r2, getOwnPropertyDescriptor: o2, getOwnPropertyNames: n2, getOwnPropertySymbols: a, getPrototypeOf: c2 } = Object;
var l = globalThis;
l.customElements ??= customElements2;
var p = l.trustedTypes;
var d = p ? p.emptyScript : "";
var u = l.reactiveElementPolyfillSupport;
var f = (t7, s5) => t7;
var b = { toAttribute(t7, s5) {
  switch (s5) {
    case Boolean:
      t7 = t7 ? d : null;
      break;
    case Object:
    case Array:
      t7 = null == t7 ? t7 : JSON.stringify(t7);
  }
  return t7;
}, fromAttribute(t7, s5) {
  let i7 = t7;
  switch (s5) {
    case Boolean:
      i7 = null !== t7;
      break;
    case Number:
      i7 = null === t7 ? null : Number(t7);
      break;
    case Object:
    case Array:
      try {
        i7 = JSON.parse(t7);
      } catch (t8) {
        i7 = null;
      }
  }
  return i7;
} };
var m = (t7, s5) => !h(t7, s5);
var y = { attribute: true, type: String, converter: b, reflect: false, useDefault: false, hasChanged: m };
Symbol.metadata ??= Symbol("metadata"), l.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var g = class extends (globalThis.HTMLElement ?? HTMLElementShimWithRealType) {
  static addInitializer(t7) {
    this._$Ei(), (this.l ??= []).push(t7);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t7, s5 = y) {
    if (s5.state && (s5.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t7) && ((s5 = Object.create(s5)).wrapped = true), this.elementProperties.set(t7, s5), !s5.noAccessor) {
      const i7 = Symbol(), e5 = this.getPropertyDescriptor(t7, i7, s5);
      void 0 !== e5 && r2(this.prototype, t7, e5);
    }
  }
  static getPropertyDescriptor(t7, s5, i7) {
    const { get: e5, set: h4 } = o2(this.prototype, t7) ?? { get() {
      return this[s5];
    }, set(t8) {
      this[s5] = t8;
    } };
    return { get: e5, set(s6) {
      const r6 = e5?.call(this);
      h4?.call(this, s6), this.requestUpdate(t7, r6, i7);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t7) {
    return this.elementProperties.get(t7) ?? y;
  }
  static _$Ei() {
    if (this.hasOwnProperty(f("elementProperties"))) return;
    const t7 = c2(this);
    t7.finalize(), void 0 !== t7.l && (this.l = [...t7.l]), this.elementProperties = new Map(t7.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(f("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(f("properties"))) {
      const t8 = this.properties, s5 = [...n2(t8), ...a(t8)];
      for (const i7 of s5) this.createProperty(i7, t8[i7]);
    }
    const t7 = this[Symbol.metadata];
    if (null !== t7) {
      const s5 = litPropertyMetadata.get(t7);
      if (void 0 !== s5) for (const [t8, i7] of s5) this.elementProperties.set(t8, i7);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t8, s5] of this.elementProperties) {
      const i7 = this._$Eu(t8, s5);
      void 0 !== i7 && this._$Eh.set(i7, t8);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t7) {
    const s5 = [];
    if (Array.isArray(t7)) {
      const e5 = new Set(t7.flat(1 / 0).reverse());
      for (const t8 of e5) s5.unshift(c(t8));
    } else void 0 !== t7 && s5.push(c(t7));
    return s5;
  }
  static _$Eu(t7, s5) {
    const i7 = s5.attribute;
    return false === i7 ? void 0 : "string" == typeof i7 ? i7 : "string" == typeof t7 ? t7.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t7) => this.enableUpdating = t7), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t7) => t7(this));
  }
  addController(t7) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t7), void 0 !== this.renderRoot && this.isConnected && t7.hostConnected?.();
  }
  removeController(t7) {
    this._$EO?.delete(t7);
  }
  _$E_() {
    const t7 = /* @__PURE__ */ new Map(), s5 = this.constructor.elementProperties;
    for (const i7 of s5.keys()) this.hasOwnProperty(i7) && (t7.set(i7, this[i7]), delete this[i7]);
    t7.size > 0 && (this._$Ep = t7);
  }
  createRenderRoot() {
    const t7 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return S(t7, this.constructor.elementStyles), t7;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach((t7) => t7.hostConnected?.());
  }
  enableUpdating(t7) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t7) => t7.hostDisconnected?.());
  }
  attributeChangedCallback(t7, s5, i7) {
    this._$AK(t7, i7);
  }
  _$ET(t7, s5) {
    const i7 = this.constructor.elementProperties.get(t7), e5 = this.constructor._$Eu(t7, i7);
    if (void 0 !== e5 && true === i7.reflect) {
      const h4 = (void 0 !== i7.converter?.toAttribute ? i7.converter : b).toAttribute(s5, i7.type);
      this._$Em = t7, null == h4 ? this.removeAttribute(e5) : this.setAttribute(e5, h4), this._$Em = null;
    }
  }
  _$AK(t7, s5) {
    const i7 = this.constructor, e5 = i7._$Eh.get(t7);
    if (void 0 !== e5 && this._$Em !== e5) {
      const t8 = i7.getPropertyOptions(e5), h4 = "function" == typeof t8.converter ? { fromAttribute: t8.converter } : void 0 !== t8.converter?.fromAttribute ? t8.converter : b;
      this._$Em = e5;
      const r6 = h4.fromAttribute(s5, t8.type);
      this[e5] = r6 ?? this._$Ej?.get(e5) ?? r6, this._$Em = null;
    }
  }
  requestUpdate(t7, s5, i7, e5 = false, h4) {
    if (void 0 !== t7) {
      const r6 = this.constructor;
      if (false === e5 && (h4 = this[t7]), i7 ??= r6.getPropertyOptions(t7), !((i7.hasChanged ?? m)(h4, s5) || i7.useDefault && i7.reflect && h4 === this._$Ej?.get(t7) && !this.hasAttribute(r6._$Eu(t7, i7)))) return;
      this.C(t7, s5, i7);
    }
    false === this.isUpdatePending && (this._$ES = this._$EP());
  }
  C(t7, s5, { useDefault: i7, reflect: e5, wrapped: h4 }, r6) {
    i7 && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t7) && (this._$Ej.set(t7, r6 ?? s5 ?? this[t7]), true !== h4 || void 0 !== r6) || (this._$AL.has(t7) || (this.hasUpdated || i7 || (s5 = void 0), this._$AL.set(t7, s5)), true === e5 && this._$Em !== t7 && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t7));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t8) {
      Promise.reject(t8);
    }
    const t7 = this.scheduleUpdate();
    return null != t7 && await t7, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [t9, s6] of this._$Ep) this[t9] = s6;
        this._$Ep = void 0;
      }
      const t8 = this.constructor.elementProperties;
      if (t8.size > 0) for (const [s6, i7] of t8) {
        const { wrapped: t9 } = i7, e5 = this[s6];
        true !== t9 || this._$AL.has(s6) || void 0 === e5 || this.C(s6, void 0, i7, e5);
      }
    }
    let t7 = false;
    const s5 = this._$AL;
    try {
      t7 = this.shouldUpdate(s5), t7 ? (this.willUpdate(s5), this._$EO?.forEach((t8) => t8.hostUpdate?.()), this.update(s5)) : this._$EM();
    } catch (s6) {
      throw t7 = false, this._$EM(), s6;
    }
    t7 && this._$AE(s5);
  }
  willUpdate(t7) {
  }
  _$AE(t7) {
    this._$EO?.forEach((t8) => t8.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t7)), this.updated(t7);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t7) {
    return true;
  }
  update(t7) {
    this._$Eq &&= this._$Eq.forEach((t8) => this._$ET(t8, this[t8])), this._$EM();
  }
  updated(t7) {
  }
  firstUpdated(t7) {
  }
};
g.elementStyles = [], g.shadowRootOptions = { mode: "open" }, g[f("elementProperties")] = /* @__PURE__ */ new Map(), g[f("finalized")] = /* @__PURE__ */ new Map(), u?.({ ReactiveElement: g }), (l.reactiveElementVersions ??= []).push("2.1.2");

// lit-html/lit-html.js
var t2 = globalThis;
var i2 = (t7) => t7;
var s2 = t2.trustedTypes;
var e2 = s2 ? s2.createPolicy("lit-html", { createHTML: (t7) => t7 }) : void 0;
var h2 = "$lit$";
var o3 = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n3 = "?" + o3;
var r3 = `<${n3}>`;
var l2 = document;
var c3 = () => l2.createComment("");
var a2 = (t7) => null === t7 || "object" != typeof t7 && "function" != typeof t7;
var u2 = Array.isArray;
var d2 = (t7) => u2(t7) || "function" == typeof t7?.[Symbol.iterator];
var f2 = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m2 = />/g;
var p2 = RegExp(`>|${f2}(?:([^\\s"'>=/]+)(${f2}*=${f2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g2 = /'/g;
var $ = /"/g;
var y2 = /^(?:script|style|textarea|title)$/i;
var x = (t7) => (i7, ...s5) => ({ _$litType$: t7, strings: i7, values: s5 });
var b2 = x(1);
var w = x(2);
var T = x(3);
var E = Symbol.for("lit-noChange");
var A = Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l2.createTreeWalker(l2, 129);
function V(t7, i7) {
  if (!u2(t7) || !t7.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e2 ? e2.createHTML(i7) : i7;
}
var N = (t7, i7) => {
  const s5 = t7.length - 1, e5 = [];
  let n6, l3 = 2 === i7 ? "<svg>" : 3 === i7 ? "<math>" : "", c5 = v;
  for (let i8 = 0; i8 < s5; i8++) {
    const s6 = t7[i8];
    let a3, u5, d3 = -1, f3 = 0;
    for (; f3 < s6.length && (c5.lastIndex = f3, u5 = c5.exec(s6), null !== u5); ) f3 = c5.lastIndex, c5 === v ? "!--" === u5[1] ? c5 = _ : void 0 !== u5[1] ? c5 = m2 : void 0 !== u5[2] ? (y2.test(u5[2]) && (n6 = RegExp("</" + u5[2], "g")), c5 = p2) : void 0 !== u5[3] && (c5 = p2) : c5 === p2 ? ">" === u5[0] ? (c5 = n6 ?? v, d3 = -1) : void 0 === u5[1] ? d3 = -2 : (d3 = c5.lastIndex - u5[2].length, a3 = u5[1], c5 = void 0 === u5[3] ? p2 : '"' === u5[3] ? $ : g2) : c5 === $ || c5 === g2 ? c5 = p2 : c5 === _ || c5 === m2 ? c5 = v : (c5 = p2, n6 = void 0);
    const x2 = c5 === p2 && t7[i8 + 1].startsWith("/>") ? " " : "";
    l3 += c5 === v ? s6 + r3 : d3 >= 0 ? (e5.push(a3), s6.slice(0, d3) + h2 + s6.slice(d3) + o3 + x2) : s6 + o3 + (-2 === d3 ? i8 : x2);
  }
  return [V(t7, l3 + (t7[s5] || "<?>") + (2 === i7 ? "</svg>" : 3 === i7 ? "</math>" : "")), e5];
};
var S2 = class _S {
  constructor({ strings: t7, _$litType$: i7 }, e5) {
    let r6;
    this.parts = [];
    let l3 = 0, a3 = 0;
    const u5 = t7.length - 1, d3 = this.parts, [f3, v3] = N(t7, i7);
    if (this.el = _S.createElement(f3, e5), P.currentNode = this.el.content, 2 === i7 || 3 === i7) {
      const t8 = this.el.content.firstChild;
      t8.replaceWith(...t8.childNodes);
    }
    for (; null !== (r6 = P.nextNode()) && d3.length < u5; ) {
      if (1 === r6.nodeType) {
        if (r6.hasAttributes()) for (const t8 of r6.getAttributeNames()) if (t8.endsWith(h2)) {
          const i8 = v3[a3++], s5 = r6.getAttribute(t8).split(o3), e6 = /([.?@])?(.*)/.exec(i8);
          d3.push({ type: 1, index: l3, name: e6[2], strings: s5, ctor: "." === e6[1] ? I : "?" === e6[1] ? L : "@" === e6[1] ? z : H }), r6.removeAttribute(t8);
        } else t8.startsWith(o3) && (d3.push({ type: 6, index: l3 }), r6.removeAttribute(t8));
        if (y2.test(r6.tagName)) {
          const t8 = r6.textContent.split(o3), i8 = t8.length - 1;
          if (i8 > 0) {
            r6.textContent = s2 ? s2.emptyScript : "";
            for (let s5 = 0; s5 < i8; s5++) r6.append(t8[s5], c3()), P.nextNode(), d3.push({ type: 2, index: ++l3 });
            r6.append(t8[i8], c3());
          }
        }
      } else if (8 === r6.nodeType) if (r6.data === n3) d3.push({ type: 2, index: l3 });
      else {
        let t8 = -1;
        for (; -1 !== (t8 = r6.data.indexOf(o3, t8 + 1)); ) d3.push({ type: 7, index: l3 }), t8 += o3.length - 1;
      }
      l3++;
    }
  }
  static createElement(t7, i7) {
    const s5 = l2.createElement("template");
    return s5.innerHTML = t7, s5;
  }
};
function M(t7, i7, s5 = t7, e5) {
  if (i7 === E) return i7;
  let h4 = void 0 !== e5 ? s5._$Co?.[e5] : s5._$Cl;
  const o7 = a2(i7) ? void 0 : i7._$litDirective$;
  return h4?.constructor !== o7 && (h4?._$AO?.(false), void 0 === o7 ? h4 = void 0 : (h4 = new o7(t7), h4._$AT(t7, s5, e5)), void 0 !== e5 ? (s5._$Co ??= [])[e5] = h4 : s5._$Cl = h4), void 0 !== h4 && (i7 = M(t7, h4._$AS(t7, i7.values), h4, e5)), i7;
}
var R = class {
  constructor(t7, i7) {
    this._$AV = [], this._$AN = void 0, this._$AD = t7, this._$AM = i7;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t7) {
    const { el: { content: i7 }, parts: s5 } = this._$AD, e5 = (t7?.creationScope ?? l2).importNode(i7, true);
    P.currentNode = e5;
    let h4 = P.nextNode(), o7 = 0, n6 = 0, r6 = s5[0];
    for (; void 0 !== r6; ) {
      if (o7 === r6.index) {
        let i8;
        2 === r6.type ? i8 = new k(h4, h4.nextSibling, this, t7) : 1 === r6.type ? i8 = new r6.ctor(h4, r6.name, r6.strings, this, t7) : 6 === r6.type && (i8 = new Z(h4, this, t7)), this._$AV.push(i8), r6 = s5[++n6];
      }
      o7 !== r6?.index && (h4 = P.nextNode(), o7++);
    }
    return P.currentNode = l2, e5;
  }
  p(t7) {
    let i7 = 0;
    for (const s5 of this._$AV) void 0 !== s5 && (void 0 !== s5.strings ? (s5._$AI(t7, s5, i7), i7 += s5.strings.length - 2) : s5._$AI(t7[i7])), i7++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t7, i7, s5, e5) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t7, this._$AB = i7, this._$AM = s5, this.options = e5, this._$Cv = e5?.isConnected ?? true;
  }
  get parentNode() {
    let t7 = this._$AA.parentNode;
    const i7 = this._$AM;
    return void 0 !== i7 && 11 === t7?.nodeType && (t7 = i7.parentNode), t7;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t7, i7 = this) {
    t7 = M(this, t7, i7), a2(t7) ? t7 === A || null == t7 || "" === t7 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t7 !== this._$AH && t7 !== E && this._(t7) : void 0 !== t7._$litType$ ? this.$(t7) : void 0 !== t7.nodeType ? this.T(t7) : d2(t7) ? this.k(t7) : this._(t7);
  }
  O(t7) {
    return this._$AA.parentNode.insertBefore(t7, this._$AB);
  }
  T(t7) {
    this._$AH !== t7 && (this._$AR(), this._$AH = this.O(t7));
  }
  _(t7) {
    this._$AH !== A && a2(this._$AH) ? this._$AA.nextSibling.data = t7 : this.T(l2.createTextNode(t7)), this._$AH = t7;
  }
  $(t7) {
    const { values: i7, _$litType$: s5 } = t7, e5 = "number" == typeof s5 ? this._$AC(t7) : (void 0 === s5.el && (s5.el = S2.createElement(V(s5.h, s5.h[0]), this.options)), s5);
    if (this._$AH?._$AD === e5) this._$AH.p(i7);
    else {
      const t8 = new R(e5, this), s6 = t8.u(this.options);
      t8.p(i7), this.T(s6), this._$AH = t8;
    }
  }
  _$AC(t7) {
    let i7 = C.get(t7.strings);
    return void 0 === i7 && C.set(t7.strings, i7 = new S2(t7)), i7;
  }
  k(t7) {
    u2(this._$AH) || (this._$AH = [], this._$AR());
    const i7 = this._$AH;
    let s5, e5 = 0;
    for (const h4 of t7) e5 === i7.length ? i7.push(s5 = new _k(this.O(c3()), this.O(c3()), this, this.options)) : s5 = i7[e5], s5._$AI(h4), e5++;
    e5 < i7.length && (this._$AR(s5 && s5._$AB.nextSibling, e5), i7.length = e5);
  }
  _$AR(t7 = this._$AA.nextSibling, s5) {
    for (this._$AP?.(false, true, s5); t7 !== this._$AB; ) {
      const s6 = i2(t7).nextSibling;
      i2(t7).remove(), t7 = s6;
    }
  }
  setConnected(t7) {
    void 0 === this._$AM && (this._$Cv = t7, this._$AP?.(t7));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t7, i7, s5, e5, h4) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t7, this.name = i7, this._$AM = e5, this.options = h4, s5.length > 2 || "" !== s5[0] || "" !== s5[1] ? (this._$AH = Array(s5.length - 1).fill(new String()), this.strings = s5) : this._$AH = A;
  }
  _$AI(t7, i7 = this, s5, e5) {
    const h4 = this.strings;
    let o7 = false;
    if (void 0 === h4) t7 = M(this, t7, i7, 0), o7 = !a2(t7) || t7 !== this._$AH && t7 !== E, o7 && (this._$AH = t7);
    else {
      const e6 = t7;
      let n6, r6;
      for (t7 = h4[0], n6 = 0; n6 < h4.length - 1; n6++) r6 = M(this, e6[s5 + n6], i7, n6), r6 === E && (r6 = this._$AH[n6]), o7 ||= !a2(r6) || r6 !== this._$AH[n6], r6 === A ? t7 = A : t7 !== A && (t7 += (r6 ?? "") + h4[n6 + 1]), this._$AH[n6] = r6;
    }
    o7 && !e5 && this.j(t7);
  }
  j(t7) {
    t7 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t7 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t7) {
    this.element[this.name] = t7 === A ? void 0 : t7;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t7) {
    this.element.toggleAttribute(this.name, !!t7 && t7 !== A);
  }
};
var z = class extends H {
  constructor(t7, i7, s5, e5, h4) {
    super(t7, i7, s5, e5, h4), this.type = 5;
  }
  _$AI(t7, i7 = this) {
    if ((t7 = M(this, t7, i7, 0) ?? A) === E) return;
    const s5 = this._$AH, e5 = t7 === A && s5 !== A || t7.capture !== s5.capture || t7.once !== s5.once || t7.passive !== s5.passive, h4 = t7 !== A && (s5 === A || e5);
    e5 && this.element.removeEventListener(this.name, this, s5), h4 && this.element.addEventListener(this.name, this, t7), this._$AH = t7;
  }
  handleEvent(t7) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t7) : this._$AH.handleEvent(t7);
  }
};
var Z = class {
  constructor(t7, i7, s5) {
    this.element = t7, this.type = 6, this._$AN = void 0, this._$AM = i7, this.options = s5;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t7) {
    M(this, t7);
  }
};
var j = { M: h2, P: o3, A: n3, C: 1, L: N, R, D: d2, V: M, I: k, H, N: L, U: z, B: I, F: Z };
var B = t2.litHtmlPolyfillSupport;
B?.(S2, k), (t2.litHtmlVersions ??= []).push("3.3.3");
var D = (t7, i7, s5) => {
  const e5 = s5?.renderBefore ?? i7;
  let h4 = e5._$litPart$;
  if (void 0 === h4) {
    const t8 = s5?.renderBefore ?? null;
    e5._$litPart$ = h4 = new k(i7.insertBefore(c3(), t8), t8, void 0, s5 ?? {});
  }
  return h4._$AI(t7), h4;
};

// lit-element/lit-element.js
var s3 = globalThis;
var i3 = class extends g {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t7 = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t7.firstChild, t7;
  }
  update(t7) {
    const r6 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t7), this._$Do = D(r6, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return E;
  }
};
i3._$litElement$ = true, i3["finalized"] = true, s3.litElementHydrateSupport?.({ LitElement: i3 });
var o4 = s3.litElementPolyfillSupport;
o4?.({ LitElement: i3 });
(s3.litElementVersions ??= []).push("4.2.2");

// @lit/reactive-element/node/decorators/property.js
var o5 = { attribute: true, type: String, converter: b, reflect: false, hasChanged: m };
var r4 = (t7 = o5, e5, r6) => {
  const { kind: n6, metadata: i7 } = r6;
  let s5 = globalThis.litPropertyMetadata.get(i7);
  if (void 0 === s5 && globalThis.litPropertyMetadata.set(i7, s5 = /* @__PURE__ */ new Map()), "setter" === n6 && ((t7 = Object.create(t7)).wrapped = true), s5.set(r6.name, t7), "accessor" === n6) {
    const { name: o7 } = r6;
    return { set(r7) {
      const n7 = e5.get.call(this);
      e5.set.call(this, r7), this.requestUpdate(o7, n7, t7, true, r7);
    }, init(e6) {
      return void 0 !== e6 && this.C(o7, void 0, t7, e6), e6;
    } };
  }
  if ("setter" === n6) {
    const { name: o7 } = r6;
    return function(r7) {
      const n7 = this[o7];
      e5.call(this, r7), this.requestUpdate(o7, n7, t7, true, r7);
    };
  }
  throw Error("Unsupported decorator location: " + n6);
};
function n4(t7) {
  return (e5, o7) => "object" == typeof o7 ? r4(t7, e5, o7) : ((t8, e6, o8) => {
    const r6 = e6.hasOwnProperty(o8);
    return e6.constructor.createProperty(o8, t8), r6 ? Object.getOwnPropertyDescriptor(e6, o8) : void 0;
  })(t7, e5, o7);
}

// @lit/reactive-element/node/decorators/state.js
function r5(r6) {
  return n4({ ...r6, state: true, attribute: false });
}

// @erplora/outfitkit/dist/define.js
function define(tag, ctor) {
  if (typeof customElements !== "undefined" && !customElements.get(tag)) {
    customElements.define(tag, ctor);
  }
}

// @erplora/outfitkit/dist/shared/icons.js
var rawAdd = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M256 112v288m144-144H112"/></svg>';
var rawAlertCircle = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="currentColor" d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208s208-93.31 208-208S370.69 48 256 48m0 319.91a20 20 0 1 1 20-20a20 20 0 0 1-20 20m21.72-201.15l-5.74 122a16 16 0 0 1-32 0l-5.74-121.94v-.05a21.74 21.74 0 1 1 43.44 0Z"/></svg>';
var rawAlertCircleOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192s192-86 192-192Z"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M250.26 166.05L256 288l5.73-121.95a5.74 5.74 0 0 0-5.79-6h0a5.74 5.74 0 0 0-5.68 6"/><path fill="currentColor" d="M256 367.91a20 20 0 1 1 20-20a20 20 0 0 1-20 20"/></svg>';
var rawAppsOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><rect width="80" height="80" x="64" y="64" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" rx="40" ry="40"/><rect width="80" height="80" x="216" y="64" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" rx="40" ry="40"/><rect width="80" height="80" x="368" y="64" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" rx="40" ry="40"/><rect width="80" height="80" x="64" y="216" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" rx="40" ry="40"/><rect width="80" height="80" x="216" y="216" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" rx="40" ry="40"/><rect width="80" height="80" x="368" y="216" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" rx="40" ry="40"/><rect width="80" height="80" x="64" y="368" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" rx="40" ry="40"/><rect width="80" height="80" x="216" y="368" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" rx="40" ry="40"/><rect width="80" height="80" x="368" y="368" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" rx="40" ry="40"/></svg>';
var rawArchiveOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M80 152v256a40.12 40.12 0 0 0 40 40h272a40.12 40.12 0 0 0 40-40V152"/><rect width="416" height="80" x="48" y="64" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" rx="28" ry="28"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="m320 304l-64 64l-64-64m64 41.89V224"/></svg>';
var rawArrowRedoOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M448 256L272 88v96C103.57 184 64 304.77 64 424c48.61-62.24 91.6-96 208-96v96Z"/></svg>';
var rawArrowUndoOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M240 424v-96c116.4 0 159.39 33.76 208 96c0-119.23-39.57-240-208-240V88L64 256Z"/></svg>';
var rawBackspaceOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M135.19 390.14a28.8 28.8 0 0 0 21.68 9.86h246.26A29 29 0 0 0 432 371.13V140.87A29 29 0 0 0 403.13 112H156.87a28.84 28.84 0 0 0-21.67 9.84L46.33 256l88.86 134.11Z"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M336.67 192.33L206.66 322.34m130.01 0L206.66 192.33m130.01 0L206.66 322.34m130.01 0L206.66 192.33"/></svg>';
var rawCalendarOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><rect width="416" height="384" x="48" y="80" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" rx="48"/><circle cx="296" cy="232" r="24" fill="currentColor"/><circle cx="376" cy="232" r="24" fill="currentColor"/><circle cx="296" cy="312" r="24" fill="currentColor"/><circle cx="376" cy="312" r="24" fill="currentColor"/><circle cx="136" cy="312" r="24" fill="currentColor"/><circle cx="216" cy="312" r="24" fill="currentColor"/><circle cx="136" cy="392" r="24" fill="currentColor"/><circle cx="216" cy="392" r="24" fill="currentColor"/><circle cx="296" cy="392" r="24" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M128 48v32m256-32v32"/><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M464 160H48"/></svg>';
var rawCheckmarkCircle = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="currentColor" d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208s208-93.31 208-208S370.69 48 256 48m108.25 138.29l-134.4 160a16 16 0 0 1-12 5.71h-.27a16 16 0 0 1-11.89-5.3l-57.6-64a16 16 0 1 1 23.78-21.4l45.29 50.32l122.59-145.91a16 16 0 0 1 24.5 20.58"/></svg>';
var rawCheckmarkOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M416 128L192 384l-96-96"/></svg>';
var rawChevronBack = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M328 112L184 256l144 144"/></svg>';
var rawChevronBackOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M328 112L184 256l144 144"/></svg>';
var rawChevronDownOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="m112 184l144 144l144-144"/></svg>';
var rawChevronForward = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="m184 112l144 144l-144 144"/></svg>';
var rawChevronForwardOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="m184 112l144 144l-144 144"/></svg>';
var rawChevronUpOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="m112 328l144-144l144 144"/></svg>';
var rawClose = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="currentColor" d="m289.94 256l95-95A24 24 0 0 0 351 127l-95 95l-95-95a24 24 0 0 0-34 34l95 95l-95 95a24 24 0 1 0 34 34l95-95l95 95a24 24 0 0 0 34-34Z"/></svg>';
var rawCloseOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144m224 0L144 368"/></svg>';
var rawCloudUploadOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M320 367.79h76c55 0 100-29.21 100-83.6s-53-81.47-96-83.6c-8.89-85.06-71-136.8-144-136.8c-69 0-113.44 45.79-128 91.2c-60 5.7-112 43.88-112 106.4s54 106.4 120 106.4h56"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="m320 255.79l-64-64l-64 64m64 192.42V207.79"/></svg>';
var rawCreateOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M384 224v184a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V168a40 40 0 0 1 40-40h167.48"/><path fill="currentColor" d="M459.94 53.25a16.06 16.06 0 0 0-23.22-.56L424.35 65a8 8 0 0 0 0 11.31l11.34 11.32a8 8 0 0 0 11.34 0l12.06-12c6.1-6.09 6.67-16.01.85-22.38M399.34 90L218.82 270.2a9 9 0 0 0-2.31 3.93L208.16 299a3.91 3.91 0 0 0 4.86 4.86l24.85-8.35a9 9 0 0 0 3.93-2.31L422 112.66a9 9 0 0 0 0-12.66l-9.95-10a9 9 0 0 0-12.71 0"/></svg>';
var rawDocumentAttachOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M208 64h66.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62V432a48 48 0 0 1-48 48H192a48 48 0 0 1-48-48V304"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M288 72v120a32 32 0 0 0 32 32h120"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M160 80v152a23.69 23.69 0 0 1-24 24c-12 0-24-9.1-24-24V88c0-30.59 16.57-56 48-56s48 24.8 48 55.38v138.75c0 43-27.82 77.87-72 77.87s-72-34.86-72-77.87V144"/></svg>';
var rawDocumentOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M416 221.25V416a48 48 0 0 1-48 48H144a48 48 0 0 1-48-48V96a48 48 0 0 1 48-48h98.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62Z"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M256 56v120a32 32 0 0 0 32 32h120"/></svg>';
var rawDocumentTextOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M416 221.25V416a48 48 0 0 1-48 48H144a48 48 0 0 1-48-48V96a48 48 0 0 1 48-48h98.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62Z"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M256 56v120a32 32 0 0 0 32 32h120m-232 80h160m-160 80h160"/></svg>';
var rawDownloadOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M336 176h40a40 40 0 0 1 40 40v208a40 40 0 0 1-40 40H136a40 40 0 0 1-40-40V216a40 40 0 0 1 40-40h40"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="m176 272l80 80l80-80M256 48v288"/></svg>';
var rawEllipsisVertical = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><circle cx="256" cy="256" r="48" fill="currentColor"/><circle cx="256" cy="416" r="48" fill="currentColor"/><circle cx="256" cy="96" r="48" fill="currentColor"/></svg>';
var rawExpandOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M432 320v112H320m101.8-10.23L304 304M80 192V80h112M90.2 90.23L208 208M320 80h112v112M421.77 90.2L304 208M192 432H80V320m10.23 101.8L208 304"/></svg>';
var rawFileTrayOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32" d="M384 80H128c-26 0-43 14-48 40L48 272v112a48.14 48.14 0 0 0 48 48h320a48.14 48.14 0 0 0 48-48V272l-32-152c-5-27-23-40-48-40Z"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M48 272h144m128 0h144m-272 0a64 64 0 0 0 128 0"/></svg>';
var rawFolderOpenOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M64 192v-72a40 40 0 0 1 40-40h75.89a40 40 0 0 1 22.19 6.72l27.84 18.56a40 40 0 0 0 22.19 6.72H408a40 40 0 0 1 40 40v40"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M479.9 226.55L463.68 392a40 40 0 0 1-39.93 40H88.25a40 40 0 0 1-39.93-40L32.1 226.55A32 32 0 0 1 64 192h384.1a32 32 0 0 1 31.8 34.55"/></svg>';
var rawInformationCircle = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="currentColor" d="M256 56C145.72 56 56 145.72 56 256s89.72 200 200 200s200-89.72 200-200S366.28 56 256 56m0 82a26 26 0 1 1-26 26a26 26 0 0 1 26-26m48 226h-88a16 16 0 0 1 0-32h28v-88h-16a16 16 0 0 1 0-32h32a16 16 0 0 1 16 16v104h28a16 16 0 0 1 0 32"/></svg>';
var rawMenuOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M80 160h352M80 256h352M80 352h352"/></svg>';
var rawNotificationsOffOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M128.51 204.59q-.37 6.15-.37 12.76C128.14 304 110 320 84.33 351.43C73.69 364.45 83 384 101.62 384H320m94.5-48.7c-18.48-23.45-30.62-47.05-30.62-118c0-79.3-40.52-107.57-73.88-121.3c-4.43-1.82-8.6-6-9.95-10.55C294.21 65.54 277.82 48 256 48s-38.2 17.55-44 37.47c-1.35 4.6-5.52 8.71-10 10.53a150 150 0 0 0-18 8.79M320 384v16a64 64 0 0 1-128 0v-16"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M448 448L64 64"/></svg>';
var rawOpenOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M384 224v184a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V168a40 40 0 0 1 40-40h167.48M336 64h112v112M224 288L440 72"/></svg>';
var rawPlayOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" d="M112 111v290c0 17.44 17 28.52 31 20.16l247.9-148.37c12.12-7.25 12.12-26.33 0-33.58L143 90.84c-14-8.36-31 2.72-31 20.16Z"/></svg>';
var rawRemove = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M400 256H112"/></svg>';
var rawSearchOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" d="M221.09 64a157.09 157.09 0 1 0 157.09 157.09A157.1 157.1 0 0 0 221.09 64Z"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M338.29 338.29L448 448"/></svg>';
var rawSend = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="currentColor" d="m476.59 227.05l-.16-.07L49.35 49.84A23.56 23.56 0 0 0 27.14 52A24.65 24.65 0 0 0 16 72.59v113.29a24 24 0 0 0 19.52 23.57l232.93 43.07a4 4 0 0 1 0 7.86L35.53 303.45A24 24 0 0 0 16 327v113.31A23.57 23.57 0 0 0 26.59 460a23.94 23.94 0 0 0 13.22 4a24.55 24.55 0 0 0 9.52-1.93L476.4 285.94l.19-.09a32 32 0 0 0 0-58.8"/></svg>';
var rawSwapVerticalOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M464 208L352 96L240 208m112-94.87V416M48 304l112 112l112-112m-112 94V96"/></svg>';
var rawTrashOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="m112 112l20 320c.95 18.49 14.4 32 32 32h184c17.67 0 30.87-13.51 32-32l20-320"/><path fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M80 112h352"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M192 112V72h0a23.93 23.93 0 0 1 24-24h80a23.93 23.93 0 0 1 24 24h0v40m-64 64v224m-72-224l8 224m136-224l-8 224"/></svg>';
var rawTrendingDown = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M352 368h112V256"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="m48 144l121.37 121.37a32 32 0 0 0 45.26 0l50.74-50.74a32 32 0 0 1 45.26 0L448 352"/></svg>';
var rawTrendingUp = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M352 144h112v112"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="m48 368l121.37-121.37a32 32 0 0 1 45.26 0l50.74 50.74a32 32 0 0 0 45.26 0L448 160"/></svg>';
var rawVolumeHighOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M126 192H56a8 8 0 0 0-8 8v112a8 8 0 0 0 8 8h69.65a15.93 15.93 0 0 1 10.14 3.54l91.47 74.89A8 8 0 0 0 240 392V120a8 8 0 0 0-12.74-6.43l-91.47 74.89A15 15 0 0 1 126 192m194 128c9.74-19.38 16-40.84 16-64c0-23.48-6-44.42-16-64m48 176c19.48-33.92 32-64.06 32-112s-12-77.74-32-112m48 272c30-46 48-91.43 48-160s-18-113-48-160"/></svg>';
var rawVolumeLowOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M189.65 192H120a8 8 0 0 0-8 8v112a8 8 0 0 0 8 8h69.65a16 16 0 0 1 10.14 3.63l91.47 75a8 8 0 0 0 12.74-6.46V119.83a8 8 0 0 0-12.74-6.44l-91.47 75a16 16 0 0 1-10.14 3.61M384 320c9.74-19.41 16-40.81 16-64c0-23.51-6-44.4-16-64"/></svg>';
var rawVolumeMuteOutline = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M416 432L64 80"/><path fill="currentColor" d="M224 136.92v33.8a4 4 0 0 0 1.17 2.82l24 24a4 4 0 0 0 6.83-2.82v-74.15a24.53 24.53 0 0 0-12.67-21.72a23.91 23.91 0 0 0-25.55 1.83a8 8 0 0 0-.66.51l-31.94 26.15a4 4 0 0 0-.29 5.92l17.05 17.06a4 4 0 0 0 5.37.26Zm0 238.16l-78.07-63.92a32 32 0 0 0-20.28-7.16H64v-96h50.72a4 4 0 0 0 2.82-6.83l-24-24a4 4 0 0 0-2.82-1.17H56a24 24 0 0 0-24 24v112a24 24 0 0 0 24 24h69.76l91.36 74.8a8 8 0 0 0 .66.51a23.93 23.93 0 0 0 25.85 1.69A24.49 24.49 0 0 0 256 391.45v-50.17a4 4 0 0 0-1.17-2.82l-24-24a4 4 0 0 0-6.83 2.82ZM352 256c0-24.56-5.81-47.88-17.75-71.27a16 16 0 0 0-28.5 14.54C315.34 218.06 320 236.62 320 256q0 4-.31 8.13a8 8 0 0 0 2.32 6.25l19.66 19.67a4 4 0 0 0 6.75-2A147 147 0 0 0 352 256m64 0c0-51.19-13.08-83.89-34.18-120.06a16 16 0 0 0-27.64 16.12C373.07 184.44 384 211.83 384 256c0 23.83-3.29 42.88-9.37 60.65a8 8 0 0 0 1.9 8.26l16.77 16.76a4 4 0 0 0 6.52-1.27C410.09 315.88 416 289.91 416 256"/><path fill="currentColor" d="M480 256c0-74.26-20.19-121.11-50.51-168.61a16 16 0 1 0-27 17.22C429.82 147.38 448 189.5 448 256c0 47.45-8.9 82.12-23.59 113a4 4 0 0 0 .77 4.55L443 391.39a4 4 0 0 0 6.4-1C470.88 348.22 480 307 480 256"/></svg>';
var rawWarning = '<svg viewBox="0 0 512 512" width="1.2em" height="1.2em" ><path fill="currentColor" d="M449.07 399.08L278.64 82.58c-12.08-22.44-44.26-22.44-56.35 0L51.87 399.08A32 32 0 0 0 80 446.25h340.89a32 32 0 0 0 28.18-47.17m-198.6-1.83a20 20 0 1 1 20-20a20 20 0 0 1-20 20m21.72-201.15l-5.74 122a16 16 0 0 1-32 0l-5.74-121.95a21.73 21.73 0 0 1 21.5-22.69h.21a21.74 21.74 0 0 1 21.73 22.7Z"/></svg>';
function bake(svg) {
  return `data:image/svg+xml;utf8,${svg}`;
}
var iconAdd = bake(rawAdd);
var iconAlertCircle = bake(rawAlertCircle);
var iconAlertCircleOutline = bake(rawAlertCircleOutline);
var iconAppsOutline = bake(rawAppsOutline);
var iconArchiveOutline = bake(rawArchiveOutline);
var iconArrowRedoOutline = bake(rawArrowRedoOutline);
var iconArrowUndoOutline = bake(rawArrowUndoOutline);
var iconBackspaceOutline = bake(rawBackspaceOutline);
var iconCalendarOutline = bake(rawCalendarOutline);
var iconCheckmarkCircle = bake(rawCheckmarkCircle);
var iconCheckmarkOutline = bake(rawCheckmarkOutline);
var iconChevronBack = bake(rawChevronBack);
var iconChevronBackOutline = bake(rawChevronBackOutline);
var iconChevronDownOutline = bake(rawChevronDownOutline);
var iconChevronForward = bake(rawChevronForward);
var iconChevronForwardOutline = bake(rawChevronForwardOutline);
var iconChevronUpOutline = bake(rawChevronUpOutline);
var iconClose = bake(rawClose);
var iconCloseOutline = bake(rawCloseOutline);
var iconCloudUploadOutline = bake(rawCloudUploadOutline);
var iconCreateOutline = bake(rawCreateOutline);
var iconDocumentAttachOutline = bake(rawDocumentAttachOutline);
var iconDocumentOutline = bake(rawDocumentOutline);
var iconDocumentTextOutline = bake(rawDocumentTextOutline);
var iconDownloadOutline = bake(rawDownloadOutline);
var iconEllipsisVertical = bake(rawEllipsisVertical);
var iconExpandOutline = bake(rawExpandOutline);
var iconFileTrayOutline = bake(rawFileTrayOutline);
var iconFolderOpenOutline = bake(rawFolderOpenOutline);
var iconInformationCircle = bake(rawInformationCircle);
var iconMenuOutline = bake(rawMenuOutline);
var iconNotificationsOffOutline = bake(rawNotificationsOffOutline);
var iconOpenOutline = bake(rawOpenOutline);
var iconPlayOutline = bake(rawPlayOutline);
var iconRemove = bake(rawRemove);
var iconSearchOutline = bake(rawSearchOutline);
var iconSend = bake(rawSend);
var iconSwapVerticalOutline = bake(rawSwapVerticalOutline);
var iconTrashOutline = bake(rawTrashOutline);
var iconTrendingDown = bake(rawTrendingDown);
var iconTrendingUp = bake(rawTrendingUp);
var iconVolumeHighOutline = bake(rawVolumeHighOutline);
var iconVolumeLowOutline = bake(rawVolumeLowOutline);
var iconVolumeMuteOutline = bake(rawVolumeMuteOutline);
var iconWarning = bake(rawWarning);
var BY_NAME = {
  "add": iconAdd,
  "alert-circle": iconAlertCircle,
  "alert-circle-outline": iconAlertCircleOutline,
  "apps-outline": iconAppsOutline,
  "archive-outline": iconArchiveOutline,
  "arrow-redo-outline": iconArrowRedoOutline,
  "arrow-undo-outline": iconArrowUndoOutline,
  "backspace-outline": iconBackspaceOutline,
  "calendar-outline": iconCalendarOutline,
  "checkmark-circle": iconCheckmarkCircle,
  "checkmark-outline": iconCheckmarkOutline,
  "chevron-back": iconChevronBack,
  "chevron-back-outline": iconChevronBackOutline,
  "chevron-down-outline": iconChevronDownOutline,
  "chevron-forward": iconChevronForward,
  "chevron-forward-outline": iconChevronForwardOutline,
  "chevron-up-outline": iconChevronUpOutline,
  "close": iconClose,
  "close-outline": iconCloseOutline,
  "cloud-upload-outline": iconCloudUploadOutline,
  "create-outline": iconCreateOutline,
  "document-attach-outline": iconDocumentAttachOutline,
  "document-outline": iconDocumentOutline,
  "document-text-outline": iconDocumentTextOutline,
  "download-outline": iconDownloadOutline,
  "ellipsis-vertical": iconEllipsisVertical,
  "expand-outline": iconExpandOutline,
  "file-tray-outline": iconFileTrayOutline,
  "folder-open-outline": iconFolderOpenOutline,
  "information-circle": iconInformationCircle,
  "menu-outline": iconMenuOutline,
  "notifications-off-outline": iconNotificationsOffOutline,
  "open-outline": iconOpenOutline,
  "play-outline": iconPlayOutline,
  "remove": iconRemove,
  "search-outline": iconSearchOutline,
  "send": iconSend,
  "swap-vertical-outline": iconSwapVerticalOutline,
  "trash-outline": iconTrashOutline,
  "trending-down": iconTrendingDown,
  "trending-up": iconTrendingUp,
  "volume-high-outline": iconVolumeHighOutline,
  "volume-low-outline": iconVolumeLowOutline,
  "volume-mute-outline": iconVolumeMuteOutline,
  "warning": iconWarning
};
function okIcon(value) {
  if (!value) return void 0;
  const trimmed = value.trimStart();
  if (trimmed.startsWith("<svg")) return bake(trimmed);
  return BY_NAME[value] ?? value;
}

// @erplora/outfitkit/dist/ok-inline-feedback.js
var __defProp2 = Object.defineProperty;
var __decorateClass2 = (decorators, target, key, kind) => {
  var result = void 0;
  for (var i7 = decorators.length - 1, decorator; i7 >= 0; i7--)
    if (decorator = decorators[i7])
      result = decorator(target, key, result) || result;
  if (result) __defProp2(target, key, result);
  return result;
};
var DEFAULT_LABELS = {
  dismiss: "Dismiss"
};
var OkInlineFeedback = class extends i3 {
  constructor() {
    super(...arguments);
    this.tone = "info";
    this.dismissible = false;
    this.hidden = false;
    this.labels = {};
    this.hasActions = false;
    this.onActionsSlotChange = (e5) => {
      const slot = e5.target;
      this.hasActions = slot.assignedNodes({ flatten: true }).length > 0;
    };
  }
  static {
    this.styles = i`
    :host {
      /* Vars overridable (estilo Ionic), default = cadena --ok-* → --ion-* → hex.
         --tone-color y --tone-icon se reasignan por tone abajo. */
      --tone-color: var(--ok-primary, var(--ion-color-primary, #3880ff));
      --background-opacity: 0.1;
      --color: var(--ok-text, var(--ion-text-color, #1c1b17));
      --border-radius: var(--ok-radius, var(--ion-border-radius, 8px));
      --padding: var(--ok-spacing, var(--ion-padding, 16px));
      --accent-width: 4px;
      --font: var(--ok-font, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);

      /* Responsive: el banner ocupa el ancho del contenedor. */
      display: block;
      width: 100%;
      font-family: var(--font);
      box-sizing: border-box;
    }
    :host([hidden]) { display: none; }

    /* Mapa de tonos → color Ionic + icono por defecto. */
    :host([tone='success']) { --tone-color: var(--ok-success, var(--ion-color-success, #2dd55b)); }
    :host([tone='warning']) { --tone-color: var(--ok-warning, var(--ion-color-warning, #ffc409)); }
    :host([tone='danger'])  { --tone-color: var(--ok-danger, var(--ion-color-danger, #c5000f)); }
    :host([tone='neutral']) { --tone-color: var(--ok-medium, var(--ion-color-medium, #5f5f5f)); }
    /* info / sin tono → primary (default ya aplicado en :host). */

    .box {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: var(--padding);
      border-radius: var(--border-radius);
      border-inline-start: var(--accent-width) solid var(--tone-color);
      /* Fondo tonal: el color del tono con baja opacidad (color-mix con fallback al borde fino). */
      background: color-mix(in srgb, var(--tone-color) calc(var(--background-opacity) * 100%), transparent);
      color: var(--color);
    }

    .icon {
      flex: 0 0 auto;
      font-size: 1.4rem;
      line-height: 1;
      color: var(--tone-color);
      margin-top: 0.05rem;
    }

    .content {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .row {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }
    .text {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .heading {
      font-weight: 700;
      font-size: 0.98rem;
      line-height: 1.3;
    }
    .body {
      font-size: 0.92rem;
      line-height: 1.45;
    }
    .actions {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    /* Si no hay actions, el slot queda vacío y no ocupa espacio. */
    .actions.empty { display: none; }

    .close {
      flex: 0 0 auto;
      background: none;
      border: 0;
      cursor: pointer;
      padding: 0.15rem;
      margin: -0.15rem -0.15rem 0 0;
      color: inherit;
      opacity: 0.6;
      font-size: 1.2rem;
      line-height: 1;
      border-radius: 4px;
      transition: background-color var(--ok-transition, 150ms ease), color var(--ok-transition, 150ms ease),
        border-color var(--ok-transition, 150ms ease), box-shadow var(--ok-transition, 150ms ease),
        opacity 0.15s ease, transform 120ms ease;
    }
    @media (hover: hover) {
      .close:hover { opacity: 1; background: rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.07); }
    }
    .close:active { transform: scale(var(--ok-press-scale, 0.97)); }

    /* Móvil: las actions bajan bajo el texto (apiladas a ancho completo). */
    @media (max-width: 640px) {
      .row { flex-direction: column; align-items: stretch; }
      .actions { width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .close:hover,
      .close:active { transform: none; }
    }
  `;
  }
  // Textos efectivos: defaults en inglés + overrides del consumidor.
  get t() {
    return { ...DEFAULT_LABELS, ...this.labels };
  }
  // Icono por defecto según el tono (overridable por la prop `icon`).
  defaultIcon() {
    switch (this.tone) {
      case "success":
        return iconCheckmarkCircle;
      case "warning":
        return iconWarning;
      case "danger":
        return iconAlertCircle;
      case "neutral":
        return iconInformationCircle;
      case "info":
      default:
        return iconInformationCircle;
    }
  }
  // Oculta el banner y avisa al consumidor; éste puede revertir restaurando `hidden=false`.
  dismiss() {
    this.hidden = true;
    this.dispatchEvent(new CustomEvent("ok-dismiss", { bubbles: true, composed: true }));
  }
  render() {
    const iconName = this.icon ?? this.defaultIcon();
    return b2`
      <div class="box" role="status">
        <ion-icon class="icon" .icon=${okIcon(iconName)} aria-hidden="true"></ion-icon>
        <div class="content">
          <div class="row">
            <div class="text">
              ${this.heading ? b2`<div class="heading">${this.heading}</div>` : null}
              <div class="body"><slot></slot></div>
            </div>
            <div class="actions ${this.hasActions ? "" : "empty"}">
              <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
            </div>
          </div>
        </div>
        ${this.dismissible ? b2`
              <button class="close" aria-label=${this.t.dismiss} @click=${this.dismiss}>
                <ion-icon .icon=${iconClose} aria-hidden="true"></ion-icon>
              </button>
            ` : null}
      </div>
    `;
  }
};
__decorateClass2([
  n4({ type: String, reflect: true })
], OkInlineFeedback.prototype, "tone");
__decorateClass2([
  n4({ type: String })
], OkInlineFeedback.prototype, "heading");
__decorateClass2([
  n4({ type: String })
], OkInlineFeedback.prototype, "icon");
__decorateClass2([
  n4({ type: Boolean, reflect: true })
], OkInlineFeedback.prototype, "dismissible");
__decorateClass2([
  n4({ type: Boolean, reflect: true })
], OkInlineFeedback.prototype, "hidden");
__decorateClass2([
  n4({ attribute: false })
], OkInlineFeedback.prototype, "labels");
__decorateClass2([
  r5()
], OkInlineFeedback.prototype, "hasActions");
define("ok-inline-feedback", OkInlineFeedback);

// @erplora/outfitkit/dist/ok-empty-state.js
var __defProp3 = Object.defineProperty;
var __decorateClass3 = (decorators, target, key, kind) => {
  var result = void 0;
  for (var i7 = decorators.length - 1, decorator; i7 >= 0; i7--)
    if (decorator = decorators[i7])
      result = decorator(target, key, result) || result;
  if (result) __defProp3(target, key, result);
  return result;
};
var OkEmptyState = class extends i3 {
  constructor() {
    super(...arguments);
    this.icon = "file-tray-outline";
  }
  static {
    this.styles = i`
    /* Ancho máximo del contenedor; bloque a 100%. */
    :host {
      display: block;
      width: 100%;
      /* Tokens propios estilo Ionic (overridables): --ok-* → --ion-* → hex. */
      --icon-color: var(--ok-color-medium, var(--ion-color-medium, #92949c));
      --heading-color: var(--ok-text-color, var(--ion-text-color, #1f2933));
      --message-color: var(--ok-color-medium, var(--ion-color-medium, #92949c));
      --icon-size: 64px;
      --padding: 2.5rem 1.25rem;
    }

    /* Centrado vertical y horizontal del contenido. */
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.5rem;
      padding: var(--padding);
      box-sizing: border-box;
      width: 100%;
    }

    ion-icon {
      font-size: var(--icon-size);
      color: var(--icon-color);
      opacity: 0.5; /* atenuado */
      margin-bottom: 0.25rem;
    }

    .heading {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--heading-color);
    }

    .message {
      margin: 0;
      font-size: 0.9375rem;
      color: var(--message-color);
      max-width: 38ch;
    }

    /* Acción debajo del texto. */
    .action {
      margin-top: 1rem;
    }

    /* Oculta los wrappers si no hay contenido. */
    .heading:empty,
    .message:empty {
      display: none;
    }
  `;
  }
  render() {
    return b2`
      <div class="wrap">
        <ion-icon .icon=${okIcon(this.icon)} aria-hidden="true"></ion-icon>
        ${this.heading ? b2`<h2 class="heading">${this.heading}</h2>` : null}
        ${this.message ? b2`<p class="message">${this.message}</p>` : null}
        <slot></slot>
        <div class="action">
          <slot name="action"></slot>
        </div>
      </div>
    `;
  }
};
__decorateClass3([
  n4()
], OkEmptyState.prototype, "icon");
__decorateClass3([
  n4()
], OkEmptyState.prototype, "heading");
__decorateClass3([
  n4()
], OkEmptyState.prototype, "message");
define("ok-empty-state", OkEmptyState);

// ui/lib/chime.ts
var TONE_SECONDS = 0.12;
var GAP_SECONDS = 0.03;
var TONE_SPECS = {
  /** The rising pair this module has always rung. Default: nobody's kitchen changes sound on an
   *  update they did not ask for. */
  chime: { wave: "sine", notes: [880, 1320] },
  /** Brighter and higher, for a line where the chime blends into the room. */
  bell: { wave: "triangle", notes: [1568, 2349] },
  /** Low, harsh and repeated: the one that carries over a hood at full blast. */
  buzzer: { wave: "square", notes: [330, 330] }
};
var CHIME_TONES = Object.keys(TONE_SPECS);
var DEFAULT_TONE = "chime";
var PEAK_GAIN_AT_MAX_VOLUME = 0.5;
var DEFAULT_VOLUME = 70;
function resolveRing(options) {
  const spec = TONE_SPECS[options?.tone ?? DEFAULT_TONE] ?? TONE_SPECS[DEFAULT_TONE];
  const asked = options?.volume;
  const volume = typeof asked === "number" && Number.isFinite(asked) ? Math.min(100, Math.max(0, asked)) : DEFAULT_VOLUME;
  return { peak: volume / 100 * PEAK_GAIN_AT_MAX_VOLUME, wave: spec.wave, notes: spec.notes };
}
function audioContextCtor() {
  const scope = globalThis;
  return scope.AudioContext ?? scope.webkitAudioContext;
}
var Chime = class {
  constructor() {
    this.unavailableReported = false;
    this.unlockArmed = false;
  }
  /**
   * Rings the chime, as loud and with the notes the hub asked for (kitchen#72). Returns `false`
   * when this browser exposes no Web Audio at all — the only case where no amount of retrying will
   * ever produce a sound. A volume of zero still returns `true`: silence chosen is not a failure.
   */
  play(options) {
    const ctx = this.context();
    if (!ctx) return false;
    const ring = resolveRing(options);
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        if (ctx.state === "suspended") this.armUnlock(ctx);
        else this.ring(ctx, ring);
      }).catch(() => this.armUnlock(ctx));
      return true;
    }
    this.ring(ctx, ring);
    return true;
  }
  context() {
    if (this.ctx) return this.ctx;
    const Ctor = audioContextCtor();
    if (!Ctor) {
      if (!this.unavailableReported) {
        this.unavailableReported = true;
        console.warn("[kitchen] this browser has no Web Audio: the KDS cannot ring on a new ticket");
      }
      return void 0;
    }
    try {
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      if (!this.unavailableReported) {
        this.unavailableReported = true;
        console.warn("[kitchen] the browser refused an AudioContext: the KDS will stay silent");
      }
      return void 0;
    }
  }
  /**
   * The browser refused to start audio without a gesture. Instead of leaving the screen mute for
   * the whole shift, unlock it on the next touch or key — the ticket that is ringing now is lost,
   * every one after it is not.
   */
  armUnlock(ctx) {
    if (this.unlockArmed) return;
    this.unlockArmed = true;
    const unlock = () => {
      ctx.resume().catch(() => void 0);
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
  }
  ring(ctx, { peak, wave, notes }) {
    if (peak <= 0) return;
    try {
      const start = ctx.currentTime;
      notes.forEach((hz, index) => {
        const at = start + index * (TONE_SECONDS + GAP_SECONDS);
        const end = at + TONE_SECONDS;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1e-4, at);
        gain.gain.linearRampToValueAtTime(peak, at + 0.01);
        gain.gain.linearRampToValueAtTime(1e-4, end);
        gain.connect(ctx.destination);
        const tone = ctx.createOscillator();
        tone.type = wave;
        tone.frequency.setValueAtTime(hz, at);
        tone.connect(gain);
        tone.start(at);
        tone.stop(end);
      });
    } catch {
    }
  }
};

// ui/lib/pass-print.ts
var QUANTITY_SCALE = 1e6;
var DEFAULT_ROLE = "kitchen";
function buildPassGroups(items) {
  const groups = /* @__PURE__ */ new Map();
  for (const item of items ?? []) {
    if ((item?.destination ?? "both") === "display") continue;
    const role = str(item.printer_role) || DEFAULT_ROLE;
    const comboRef = str(item.combo_ref);
    const line = {
      name: str(item.product_name),
      quantity: num(item.quantity ?? QUANTITY_SCALE) / QUANTITY_SCALE,
      ...item.notes ? { notes: str(item.notes) } : {},
      ...item.modifiers ? { modifiers: str(item.modifiers) } : {},
      ...comboRef ? { combo_ref: comboRef, combo_name: str(item.combo_name) } : {}
    };
    const group = groups.get(role);
    if (group) group.push(line);
    else groups.set(role, [line]);
  }
  return [...groups].map(([role, lines]) => ({ role, items: lines }));
}
async function printPass(orderId, deps, options = {}) {
  const print = deps.print;
  if (typeof print !== "function") return { ok: false, sheets: 0, reason: "no_gate" };
  let groups;
  let header;
  try {
    const [items, headers] = await Promise.all([
      deps.query("kitchen.orders.items", { order_id: orderId }),
      deps.query("kitchen.orders.get", { order_id: orderId })
    ]);
    groups = buildPassGroups(Array.isArray(items) ? items : []);
    header = first(headers) ?? {};
  } catch (e5) {
    console.warn("[kitchen] the pass could not be read, so nothing was printed", e5);
    return { ok: false, sheets: 0, reason: "threw", detail: message(e5) };
  }
  if (!groups.length) return { ok: true, sheets: 0, reason: "nothing_to_print" };
  const waiter = options.resolveWaiter ? options.resolveWaiter(str(header.waiter_id)).trim() : "";
  const data = {
    receipt_id: str(header.order_number),
    label: str(header.label),
    round_number: num(header.round_number ?? 1),
    ...waiter ? { waiter } : {}
  };
  let sheets = 0;
  let reason;
  let detail;
  for (const group of groups) {
    try {
      const result = await print({
        role: group.role,
        documentType: "kitchen_order",
        // Unattended: nobody is standing in front of the pass to accept a browser dialog, and that
        // dialog would freeze the KDS of a busy service.
        fallbackToBrowser: false,
        jobId: `kitchen-pass-${orderId}-${group.role}`,
        data: { ...data, items: group.items }
      });
      const via = result?.via ?? "none";
      if (via === "bridge" || via === "queue" || via === "browser") {
        sheets += 1;
        continue;
      }
      reason = "no_printer";
      detail = result?.error ?? detail;
      console.warn(`[kitchen] no printer with role ${group.role}: the pass did not come out`, result?.error ?? "");
    } catch (e5) {
      reason = "threw";
      detail = message(e5);
      console.warn(`[kitchen] the ${group.role} printer refused the pass`, e5);
    }
  }
  return sheets === groups.length ? { ok: true, sheets } : { ok: false, sheets, reason: reason ?? "gate_error", detail };
}
function first(v3) {
  return Array.isArray(v3) ? v3[0] : v3;
}
function num(v3) {
  return typeof v3 === "number" ? v3 : Number(v3 ?? 0) || 0;
}
function str(v3) {
  return v3 == null ? "" : String(v3);
}
function message(e5) {
  return e5 instanceof Error ? e5.message : String(e5);
}

// locales/es.json
var es_default = {
  name: "Cocina",
  description: "Pantalla de cocina y \xF3rdenes de producci\xF3n, seguidas desde que entran hasta que est\xE1n listas.",
  navigation: {
    display: {
      label: "Pantalla"
    },
    active: {
      label: "Comandas"
    },
    stations: {
      label: "Estaciones"
    },
    history: {
      label: "Historial"
    }
  },
  settings: {
    title: "Cocina",
    fields: {
      show_timer: {
        label: "Mostrar cron\xF3metro"
      },
      warning_time_minutes: {
        label: "Aviso \xE1mbar (minutos)"
      },
      critical_time_minutes: {
        label: "Aviso rojo (minutos)"
      },
      color_coding_enabled: {
        label: "Sem\xE1foro de color"
      },
      sound_enabled: {
        label: "Sonar al entrar una comanda"
      },
      sound_volume: {
        label: "Volumen del sonido (0-100)",
        description: "Lo fuerte que suena el aviso. Por defecto suena como ha sonado siempre; una cocina con extractor suele necesitar m\xE1s."
      },
      sound_tone: {
        label: "Tono del sonido",
        description: "Qu\xE9 sonido hace una comanda nueva: campanilla, timbre o zumbador. El zumbador es el que se oye con la campana a tope."
      },
      auto_print_tickets: {
        label: "Imprimir el pase al marcar listo",
        description: "Cada vez que se marca lista una comanda, saca en la impresora de cada estaci\xF3n los platos que salen. No es la comanda del disparo, que ya la imprime el enrutado por estaci\xF3n."
      },
      default_order_type: {
        label: "Tipo de comanda por defecto"
      }
    }
  },
  ui: {
    colAction: "Acci\xF3n",
    colOrder: "Comanda",
    colNotes: "Notas",
    colWhen: "Cu\xE1ndo",
    actionReceived: "Recibidas",
    actionStarted: "Lanzadas",
    actionBumped: "Listas (bump)",
    actionServed: "Servidas",
    actionRecalled: "Recuperadas",
    actionCancelled: "Canceladas",
    searchLogs: "Buscar acci\xF3n, comanda o notas\u2026",
    loading: "Cargando\u2026",
    emptyLogs: "Sin actividad reciente en cocina.",
    ordersTitle: "Comandas",
    colType: "Tipo",
    colPriority: "Prioridad",
    colStatus: "Estado",
    colTotal: "Total",
    statusPending: "Pendiente",
    statusPreparing: "En preparaci\xF3n",
    statusReady: "Lista",
    statusServed: "Servida",
    statusCancelled: "Cancelada",
    rowFire: "Lanzar",
    rowMarkReady: "Lista",
    rowMarkServed: "Servida",
    rowRecall: "Recuperar",
    rowCancel: "Cancelar",
    placeholderType: "Tipo",
    placeholderNotes: "Notas",
    newOrder: "Nueva comanda",
    creatingOrder: "Creando\u2026",
    createOrderError: "No se pudo crear la comanda",
    updateStatusError: "No se pudo actualizar el estado",
    searchOrders: "Buscar comanda o estado\u2026",
    emptyOrders: "Sin comandas.",
    stationsTitle: "Estaciones de producci\xF3n",
    colStation: "Estaci\xF3n",
    colPrinter: "Impresora",
    colInProgress: "En curso",
    colActive: "Activa",
    yes: "S\xED",
    no: "No",
    rowEdit: "Editar",
    rowRoute: "Enrutar",
    rowDelete: "Eliminar",
    placeholderStationName: "p. ej. Plancha",
    placeholderPrinterOptional: "(opcional)",
    addStation: "A\xF1adir",
    createStationError: "No se pudo crear la estaci\xF3n",
    editStationTitle: "Editar estaci\xF3n",
    labelName: "Nombre",
    labelColor: "Color",
    labelPrinter: "Impresora",
    labelActive: "Activa",
    save: "Guardar",
    saving: "Guardando\u2026",
    cancel: "Cancelar",
    stationUpdated: "Estaci\xF3n actualizada",
    updateStationError: "No se pudo actualizar la estaci\xF3n",
    routingTitle: "Enrutado producto/categor\xEDa \u2192 estaci\xF3n",
    placeholderStation: "Estaci\xF3n",
    labelProduct: "Producto",
    labelCategory: "Categor\xEDa",
    placeholderOptional: "(opcional)",
    saveRouting: "Guardar enrutado",
    routingSaved: "Enrutado guardado",
    saveRoutingError: "No se pudo guardar el enrutado",
    deleteStationError: "No se pudo eliminar la estaci\xF3n",
    searchStations: "Buscar estaci\xF3n\u2026",
    emptyStations: "Sin estaciones.",
    colLabel: "Destino",
    fireUrgent: "Enviar URGENTE",
    fireToKitchen: "Enviar comanda",
    markUrgent: "Ronda urgente",
    firedBy: "Camarero: {name}",
    posComandas: "Comandas",
    posComandasTitle: "Comandas de la cuenta",
    comandaN: "Comanda {n}",
    stQueued: "En cola",
    stPreparing: "Preparando",
    stReady: "Lista",
    stServed: "Servida",
    stPaid: "Pagada",
    stCancelled: "Anulada",
    close: "Cerrar",
    historyTitle: "Historial de cocina",
    loadError: "No se pudo cargar la pantalla de cocina",
    modeTickets: "Comandas",
    modeAllDay: "Resumen",
    stationAll: "Todas",
    stationNone: "Sin estaci\xF3n",
    bump: "Listo",
    recall: "Recuperar",
    tapToBump: "toca para marcar listo",
    tapToRecall: "toca para recuperar",
    tapHeaderToBump: "Marcar listas todas las l\xEDneas en pantalla",
    ticketAria: "Comanda {n}",
    round: "Ronda {n}",
    seat: "Comensal",
    printerOnly: "Solo impresora",
    priority_normal: "Normal",
    priority_rush: "Urgente",
    priority_vip: "VIP",
    orderType_dine_in: "En sala",
    orderType_takeaway: "Para llevar",
    orderType_delivery: "A domicilio",
    readyRail: "Listas",
    emptyDisplay: "No hay comandas en marcha.",
    emptyReady: "No hay nada esperando a recoger.",
    fullscreen: "Pantalla completa",
    exitFullscreen: "Salir de pantalla completa",
    emptyAllDay: "No queda nada por cocinar.",
    colProduct: "Producto",
    actionItemBumped: "L\xEDnea lista",
    actionItemRecalled: "L\xEDnea recuperada",
    tapMenuToBump: "Toca para marcar listos los platos de este men\xFA",
    comboAria: "Men\xFA {name}, {n} platos",
    comboCount: "{n} platos",
    passPrintFailed: "No se ha podido imprimir el pase. Revisa la impresora de la estaci\xF3n.",
    comboFallbackName: "Men\xFA"
  },
  errors: {
    "kitchen.invalid_transition": "Esa comanda ya no est\xE1 en el estado que requiere esta acci\xF3n. Actualiza e int\xE9ntalo de nuevo.",
    "kitchen.order_unavailable": "Esa comanda no est\xE1 disponible: no existe en este negocio o se ha borrado."
  }
};

// locales/en.json
var en_default = {
  name: "Kitchen",
  navigation: {
    display: {
      label: "Display"
    },
    active: {
      label: "Commands"
    },
    stations: {
      label: "Stations"
    },
    history: {
      label: "History"
    }
  },
  settings: {
    title: "Kitchen",
    fields: {
      show_timer: {
        label: "Show timer"
      },
      warning_time_minutes: {
        label: "Amber warning (minutes)"
      },
      critical_time_minutes: {
        label: "Red alert (minutes)"
      },
      color_coding_enabled: {
        label: "Colour semaphore"
      },
      sound_enabled: {
        label: "Sound on a new ticket"
      },
      sound_volume: {
        label: "Sound volume (0-100)",
        description: "How loud the chime rings. The default is the volume this module has always rung at; a kitchen with an extractor fan usually needs more."
      },
      sound_tone: {
        label: "Sound tone",
        description: "Which sound a new ticket makes: chime, bell or buzzer. The buzzer is the one that carries over a hood at full blast."
      },
      auto_print_tickets: {
        label: "Print the pass when marked ready",
        description: "Every time a ticket is bumped, prints the plates going out on the printer of their station. It is not the kitchen order at fire time, which station routing already prints."
      },
      default_order_type: {
        label: "Default order type"
      }
    }
  },
  ui: {
    colAction: "Action",
    colOrder: "Order",
    colNotes: "Notes",
    colWhen: "When",
    actionReceived: "Received",
    actionStarted: "Fired",
    actionBumped: "Ready (bump)",
    actionServed: "Served",
    actionRecalled: "Recalled",
    actionCancelled: "Cancelled",
    searchLogs: "Search action, order or notes\u2026",
    loading: "Loading\u2026",
    emptyLogs: "No recent kitchen activity.",
    ordersTitle: "Orders",
    colType: "Type",
    colPriority: "Priority",
    colStatus: "Status",
    colTotal: "Total",
    statusPending: "Pending",
    statusPreparing: "Preparing",
    statusReady: "Ready",
    statusServed: "Served",
    statusCancelled: "Cancelled",
    rowFire: "Fire",
    rowMarkReady: "Ready",
    rowMarkServed: "Served",
    rowRecall: "Recall",
    rowCancel: "Cancel",
    placeholderType: "Type",
    placeholderNotes: "Notes",
    newOrder: "New order",
    creatingOrder: "Creating\u2026",
    createOrderError: "Could not create order",
    updateStatusError: "Could not update status",
    searchOrders: "Search order or status\u2026",
    emptyOrders: "No orders.",
    stationsTitle: "Production stations",
    colStation: "Station",
    colPrinter: "Printer",
    colInProgress: "In progress",
    colActive: "Active",
    yes: "Yes",
    no: "No",
    rowEdit: "Edit",
    rowRoute: "Route",
    rowDelete: "Delete",
    placeholderStationName: "e.g. Grill",
    placeholderPrinterOptional: "(optional)",
    addStation: "Add",
    createStationError: "Could not create station",
    editStationTitle: "Edit station",
    labelName: "Name",
    labelColor: "Color",
    labelPrinter: "Printer",
    labelActive: "Active",
    save: "Save",
    saving: "Saving\u2026",
    cancel: "Cancel",
    stationUpdated: "Station updated",
    updateStationError: "Could not update station",
    routingTitle: "Product/category routing \u2192 station",
    placeholderStation: "Station",
    labelProduct: "Product",
    labelCategory: "Category",
    placeholderOptional: "(optional)",
    saveRouting: "Save routing",
    routingSaved: "Routing saved",
    saveRoutingError: "Could not save routing",
    deleteStationError: "Could not delete station",
    searchStations: "Search station\u2026",
    emptyStations: "No stations.",
    colLabel: "Where",
    fireUrgent: "Send URGENT",
    fireToKitchen: "Send order",
    markUrgent: "Urgent round",
    firedBy: "Waiter: {name}",
    posComandas: "Tickets",
    posComandasTitle: "Order tickets",
    comandaN: "Order ticket {n}",
    stQueued: "Queued",
    stPreparing: "Preparing",
    stReady: "Ready",
    stServed: "Served",
    stPaid: "Paid",
    stCancelled: "Cancelled",
    close: "Close",
    historyTitle: "Kitchen history",
    loadError: "Could not load the kitchen display",
    modeTickets: "Tickets",
    modeAllDay: "All-Day",
    stationAll: "All",
    stationNone: "No station",
    bump: "Bump",
    recall: "Recall",
    tapToBump: "tap to bump",
    tapToRecall: "tap to recall",
    tapHeaderToBump: "Bump every line on screen",
    ticketAria: "Ticket {n}",
    round: "Round {n}",
    seat: "Seat",
    printerOnly: "Printer only",
    priority_normal: "Normal",
    priority_rush: "Rush",
    priority_vip: "VIP",
    orderType_dine_in: "Dine in",
    orderType_takeaway: "Takeaway",
    orderType_delivery: "Delivery",
    readyRail: "Ready",
    emptyDisplay: "No tickets on the line.",
    emptyReady: "Nothing waiting to be picked up.",
    fullscreen: "Full screen",
    exitFullscreen: "Exit full screen",
    emptyAllDay: "Nothing left to cook.",
    colProduct: "Product",
    actionItemBumped: "Line ready",
    actionItemRecalled: "Line recalled",
    tapMenuToBump: "Tap to mark this menu's dishes ready",
    comboAria: "Menu {name}, {n} dishes",
    comboCount: "{n} dishes",
    passPrintFailed: "The pass could not be printed. Check the printer of the station.",
    comboFallbackName: "Menu"
  },
  errors: {
    "kitchen.invalid_transition": "That kitchen order is no longer in the state this action requires. Refresh and try again.",
    "kitchen.order_unavailable": "That kitchen order is not available: it does not exist in this business or it has been deleted."
  }
};

// ui/components/erp-kitchen-display/erp-kitchen-display.ts
var CATALOG = { es: es_default, en: en_default };
var DEFAULT_SETTINGS = {
  show_timer: true,
  color_coding_enabled: true,
  warning_time_minutes: 15,
  critical_time_minutes: 30,
  sound_enabled: true,
  sound_volume: DEFAULT_VOLUME,
  sound_tone: DEFAULT_TONE,
  // Off, like Toast, Fresh KDS and MobiPOS ship it: paper nobody asked for is a regression.
  auto_print_tickets: false
};
var QUANTITY_SCALE2 = 1e6;
var COOKING = ["pending", "preparing"];
var NO_STATION = "__none";
function erplora() {
  const c5 = globalThis.erplora;
  if (!c5) throw new Error("erplora SDK not initialised by the shell");
  return c5;
}
function can(permission) {
  const client = erplora();
  return typeof client.hasPermission === "function" ? client.hasPermission(permission) : true;
}
function truthy(v3) {
  return v3 === true || v3 === 1 || v3 === "1" || v3 === "true";
}
function volumeOf(v3) {
  const n6 = Number(v3);
  return Number.isFinite(n6) ? Math.min(100, Math.max(0, n6)) : DEFAULT_VOLUME;
}
function toneOf(v3) {
  const name = String(v3 ?? "");
  return CHIME_TONES.includes(name) ? name : DEFAULT_TONE;
}
function orderIdOf(payload) {
  if (payload && typeof payload === "object") {
    const p4 = payload;
    const id = p4.order_id ?? p4.id;
    return id == null ? "" : String(id);
  }
  return "";
}
function errorText(e5, fallbackKey) {
  const code = e5?.code;
  if (typeof code === "string") {
    const lang = CATALOG[erplora().locale] ?? CATALOG.en;
    const text = lang?.errors?.[code] ?? CATALOG.en.errors?.[code];
    if (text) return text;
  }
  return e5 instanceof Error ? e5.message : erplora().t(CATALOG, fallbackKey);
}
function groupTickets(rows2) {
  const byId = /* @__PURE__ */ new Map();
  for (const r6 of rows2) {
    let t7 = byId.get(r6.order_id);
    if (!t7) {
      t7 = {
        id: r6.order_id,
        number: String(r6.order_number ?? ""),
        status: String(r6.order_status ?? ""),
        order_type: String(r6.order_type ?? ""),
        priority: String(r6.priority ?? "normal"),
        label: String(r6.label ?? ""),
        waiter_id: String(r6.waiter_id ?? ""),
        round: Number(r6.round_number ?? 1) || 1,
        notes: String(r6.order_notes ?? ""),
        since: String(r6.order_fired_at ?? r6.order_created_at ?? ""),
        lines: []
      };
      byId.set(r6.order_id, t7);
    }
    if (r6.item_id) {
      t7.lines.push({
        id: r6.item_id,
        station_id: r6.station_id === null || r6.station_id === void 0 || r6.station_id === "" ? null : String(r6.station_id),
        station: String(r6.station_name ?? ""),
        destination: String(r6.destination ?? "both"),
        product_name: String(r6.product_name ?? ""),
        quantity: Number(r6.quantity ?? QUANTITY_SCALE2) || 0,
        modifiers: String(r6.modifiers ?? ""),
        notes: String(r6.item_notes ?? ""),
        status: String(r6.item_status ?? "pending"),
        seat: r6.seat_number === null || r6.seat_number === void 0 || r6.seat_number === "" ? null : Number(r6.seat_number),
        combo_ref: r6.combo_ref === null || r6.combo_ref === void 0 || r6.combo_ref === "" ? null : String(r6.combo_ref),
        combo_name: String(r6.combo_name ?? "")
      });
    }
  }
  return Array.from(byId.values());
}
function groupCombos(lines) {
  const out = [];
  for (const l3 of lines) {
    const prev = out[out.length - 1];
    if (l3.combo_ref && prev && prev.ref === l3.combo_ref) {
      prev.lines.push(l3);
      continue;
    }
    out.push({ ref: l3.combo_ref, name: l3.combo_ref ? l3.combo_name : "", lines: [l3] });
  }
  return out;
}
function formatQty(micro, locale) {
  const units = micro / QUANTITY_SCALE2;
  return new Intl.NumberFormat(locale || "en", { maximumFractionDigits: 3 }).format(units);
}
function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1e3));
  const h4 = Math.floor(total / 3600);
  const m4 = Math.floor(total % 3600 / 60);
  const s5 = total % 60;
  const mm = h4 > 0 ? String(m4).padStart(2, "0") : String(m4);
  return `${h4 > 0 ? `${h4}:` : ""}${mm}:${String(s5).padStart(2, "0")}`;
}
function semaphore(elapsedMs, s5) {
  if (!s5.color_coding_enabled) return "off";
  const min = elapsedMs / 6e4;
  if (min >= s5.critical_time_minutes) return "critical";
  if (min >= s5.warning_time_minutes) return "warning";
  return "ok";
}
var ErpKitchenDisplay = class extends i3 {
  constructor() {
    super(...arguments);
    this.station = "";
    this.mode = "tickets";
    this.chrome = "";
    this.fullscreen = false;
    this.rows = [];
    this.allDay = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.stationsById = /* @__PURE__ */ new Map();
    this.waitersById = /* @__PURE__ */ new Map();
    this.error = "";
    this.passWarning = "";
    this.loading = false;
    this.now = Date.now();
    /** kitchen#48 · the chime, one audio context for the whole shift. */
    this.chime = new Chime();
    this.onLocaleChange = () => this.requestUpdate();
  }
  static {
    this.styles = i`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    /* kitchen#60 · ONE command bar. It used to be two rows —an h2 plus a full-width mode segment,
       then a full-width station segment— which is ~190 px of chrome before the first ticket; a KDS
       header is ~48 px (Toast, Square, Fresh, Simphony). Sticky because a busy board scrolls, and
       scrolling the station filter off the top strands whoever is at the pass. */
    .bar { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; padding:0 0 .4rem;
           position:sticky; top:0; z-index:2; background: var(--ion-background-color, #fff); }
    ion-segment { min-height:44px; }
    /* Ionic gives the ion-segment host a width of 100%, so on its own each segment IS a full-width
       row. A rule from the OUTER tree —this one— beats the component's own :host, which is what
       lets the two controls share one line: views keeps its width, stations takes what is left. */
    ion-segment.views { width:auto; flex:0 0 auto; }
    /* Shrinks when the row is tight and SCROLLS after that, but never stretches: a four-station
       kitchen whose chips were spread across 1180 px reads as four buttons, not as a filter. */
    ion-segment.stations { width:auto; flex:0 1 auto; min-width:0; max-width:100%; }
    ion-segment-button { min-height:44px; --padding-start:.6rem; --padding-end:.6rem; text-transform:none; }
    .count { font-variant-numeric: tabular-nums; opacity:.7; margin-left:.35rem; }
    /* Full screen: a plain button, not a ⋮ menu — this screen has exactly one chrome control and
       the market answer to «two ways to do the same thing» is one way (ADR-0048 owns the rest).
       It sits NEXT TO the view tabs, not pinned to the right edge: an auto left margin gave it a
       third row of its own the moment the bar wrapped on a phone, and both controls are about the
       SCREEN anyway, while the stations chips are about the food. */
    .fs { min-width:44px; min-height:44px; display:inline-flex; align-items:center; justify-content:center;
          border:1px solid var(--ion-border-color, #e7e2d6); border-radius: var(--ok-radius-sm, 10px);
          background:transparent; color:inherit; font-size:1.25rem; cursor:pointer; }
    ion-button { min-height:44px; --padding-start:1rem; --padding-end:1rem; margin:0; }
    /* kitchen#60 · the column grows with the screen instead of sitting at a fixed 17 rem: on a
       1440 board that gave five narrow cards and ~70 % white. Equal tracks that do NOT resize with
       the number of tickets — Toast and Fresh both fix the columns on purpose, because a card that
       changes size every time an order lands is a card the cook has to find again. */
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(clamp(15rem, 22vw, 22rem), 1fr)); gap:.6rem; align-items:start; }
    .card { border:1px solid var(--ion-border-color, #e7e2d6); border-top-width:6px; border-radius: var(--ok-radius-sm, 10px);
            background: var(--ion-item-background, var(--ion-background-color, #fff)); display:flex; flex-direction:column; overflow:hidden; }
    .card[data-sem="ok"] { border-top-color: var(--ion-color-success, #2dd36f); }
    .card[data-sem="warning"] { border-top-color: var(--ion-color-warning, #ffc409); }
    .card[data-sem="critical"] { border-top-color: var(--ion-color-danger, #eb445a); }
    .card[data-sem="critical"] .timer { color: var(--ion-color-danger, #eb445a); }
    .card[data-sem="warning"] .timer { color: var(--ion-color-warning-shade, #e0ac08); }
    .card[data-sem="off"] { border-top-color: var(--ion-border-color, #e7e2d6); }
    .card[data-status="ready"] { opacity:.85; }
    /* kitchen#60 · the header WRAPS instead of squeezing. With the type at kitchen size, a narrow
       column had «Mesa 7» and «Camarero: Luis» both collapse to «M…» / «Ca…» once a RUSH pill and
       the clock claimed the row — which is the one thing kitchen#67 exists to show. The table and
       who fired it keep the first line; the pills, the clock and the number drop to a second one. */
    .head { display:flex; align-items:center; flex-wrap:wrap; gap:.35rem .5rem; padding:.6rem .75rem; min-height:44px; cursor:pointer; user-select:none;
            background: var(--ok-surface-2, var(--ion-color-step-50, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.04))); }
    .head[aria-disabled="true"] { cursor:default; }
    /* The table and, under it, who fired the round (kitchen#63) — the header layout Toast, Square
       for Restaurants and Lightspeed use. A column so the waiter never competes with the pills for
       the row: on a 17rem card the label would be the first thing squeezed. */
    .head .title { flex:1 1 60%; min-width:0; display:flex; flex-direction:column; gap:.05rem; }
    /* kitchen#60 · type for a kitchen: this is read from a metre away, standing, in a hurry. The
       market sizes the dish and the quantity XL (Fresh, Square, Simphony) and leaves the rest
       quiet — so the dish and the count grow, the pills and the ticket number do not. */
    .head .label { font-weight:700; font-size:1.3rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .head .waiter { font-size:.95rem; font-weight:500; opacity:.72; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .head .num { font-variant-numeric: tabular-nums; font-size:.9rem; opacity:.75; }
    .timer { font-variant-numeric: tabular-nums; font-weight:700; font-size:1.25rem; }
    .pill { display:inline-block; padding:.1rem .5rem; border-radius: var(--ok-radius-pill, 999px); font-size:.75rem; font-weight:700; text-transform:uppercase; }
    .pill.rush { background: var(--ion-color-danger, #eb445a); color:#fff; }
    .pill.vip { background: var(--ion-color-tertiary, #6030ff); color:#fff; }
    .pill.round { background: var(--ok-surface-2, rgba(0,0,0,.06)); }
    .pill.ready { background: var(--ion-color-success, #2dd36f); color:#fff; }
    .lines { list-style:none; margin:0; padding:0; }
    .line { display:flex; gap:.6rem; align-items:flex-start; padding:.55rem .75rem; min-height:44px; border-top:1px solid var(--ion-border-color, #e7e2d6);
            cursor:pointer; user-select:none; -webkit-tap-highlight-color: transparent; }
    .line[aria-disabled="true"] { cursor:default; }
    .line:active { background: var(--ok-surface-2, rgba(0,0,0,.05)); }
    .line .qty { font-weight:800; font-size:1.6rem; min-width:2ch; text-align:right; font-variant-numeric: tabular-nums; }
    .line .body { flex:1; min-width:0; }
    .line .name { font-weight:600; font-size:1.4rem; }
    .line .mods, .line .note { font-size:1.05rem; opacity:.85; }
    .line .note { font-style:italic; }
    .line .meta { font-size:1rem; opacity:.7; display:flex; gap:.5rem; }
    .line[data-status="ready"] .name, .line[data-status="ready"] .qty { text-decoration: line-through; opacity:.55; }
    .line .tick { font-size:1.4rem; line-height:1; color: var(--ion-color-success, #2dd36f); }
    /* kitchen#57 · A MENU: a quiet header and its components indented behind a rule. The emphasis
       stays on the DISH — the market highlights allergens and changes, never hierarchy — so the
       header is smaller and dimmer than the lines it introduces, not louder. */
    .combo { display:block; border-top:1px solid var(--ion-border-color, #e7e2d6); }
    .combo-head { display:flex; align-items:center; gap:.4rem; min-height:44px; padding:.35rem .75rem;
      font-size:.95rem; text-transform:uppercase; letter-spacing:.04em; opacity:.75;
      background: var(--ok-surface-2, rgba(0,0,0,.035)); cursor:pointer; }
    .combo-head[aria-disabled="true"] { cursor:default; }
    .combo-head:active { background: var(--ok-surface-3, rgba(0,0,0,.07)); }
    .combo-name { font-weight:700; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .combo-count { font-variant-numeric: tabular-nums; }
    .combo-head .tick { margin-left:auto; font-size:1.1rem; line-height:1; color: var(--ion-color-success, #2dd36f); }
    .combo-lines { list-style:none; margin:0; padding:0 0 0 .75rem;
      border-left:3px solid var(--ion-color-medium, #9d968a); margin-left:.75rem; }
    /* The rule already says «these belong together»; a second border per component would only add
       noise, so inside a menu the lines lose their own top border except between siblings. */
    .combo-lines .line:first-child { border-top:0; }
    .combo[data-combo-done="true"] .combo-head { opacity:.5; }
    .combo[data-combo-done="true"] .combo-name { text-decoration: line-through; }
    .foot { display:flex; gap:.5rem; padding:.5rem .75rem; border-top:1px solid var(--ion-border-color, #e7e2d6); }
    .foot ion-button { flex:1; }
    /* kitchen#42 — el fondo del bump se declara AQUÍ, dentro del shadow root, y no con
       \`color="success"\`. Ionic implementa \`color=\` con la regla GLOBAL
       \`.ion-color-success { --ion-color-base: … }\`, que vive en la hoja del documento y NO
       atraviesa el shadow root de un WC de módulo: dentro, el selector no casa con nada,
       \`--ion-color-base\` queda vacío y \`button-solid { background: var(--ion-color-base) }\`
       resuelve a transparente — texto blanco sobre tarjeta blanca, contraste 1:1. Las custom
       properties sí heredan a través del límite, así que el token se lee sin problema.
       Hermana del gotcha de \`fill\` + \`mode="ios"\` (ADR-0143, hub#760/#1060). */
    .foot ion-button[data-action="bump"] {
      --background: var(--ion-color-success);
      --background-activated: var(--ion-color-success-shade);
      --background-hover: var(--ion-color-success-tint);
      --color: var(--ion-color-success-contrast);
    }
    .notes { padding:.4rem .75rem; font-size:.85rem; font-style:italic; opacity:.85; border-top:1px dashed var(--ion-border-color, #e7e2d6); }
    .allday { width:100%; border-collapse:collapse; }
    .allday td, .allday th { padding:.6rem .75rem; text-align:left; border-bottom:1px solid var(--ion-border-color, #e7e2d6); min-height:44px; }
    .allday td.q { font-weight:800; font-size:1.2rem; text-align:right; font-variant-numeric: tabular-nums; width:6ch; }
    .allday td.s { opacity:.7; font-size:.95rem; }
    @media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }
  `;
  }
  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener("erplora:locale-changed", this.onLocaleChange);
    await Promise.all([this.loadSettings(), this.load()]);
    try {
      const reload = () => this.load();
      const offs = [
        erplora().on("kitchen.order.created", reload),
        erplora().on("kitchen.order.updated", reload),
        erplora().on("kitchen.order.fired", reload),
        // kitchen#70 · the bump is where the pass goes to paper (Toast, Fresh KDS, Lightspeed K,
        // MobiPOS and Square all print here). The board reloads either way: a printer out of paper
        // must never keep the screen from updating.
        erplora().on("kitchen.order.ready", (payload) => {
          void this.printPassFor(payload);
          reload();
        }),
        erplora().on("kitchen.order.served", reload),
        erplora().on("kitchen.order.recalled", reload),
        erplora().on("kitchen.order.cancelled", reload),
        erplora().on("kitchen.order.deleted", reload),
        erplora().on("kitchen.item.bumped", reload),
        erplora().on("kitchen.item.recalled", reload),
        erplora().on("kitchen.settings.updated", () => this.loadSettings())
      ];
      this.unsub = () => offs.forEach((off) => off());
    } catch {
    }
    this.clock = setInterval(() => this.now = Date.now(), 1e3);
  }
  disconnectedCallback() {
    window.removeEventListener("erplora:locale-changed", this.onLocaleChange);
    if (this.clock) clearInterval(this.clock);
    this.unsub?.();
    super.disconnectedCallback();
  }
  async loadSettings() {
    try {
      const rows2 = await erplora().query("kitchen.settings.get");
      const row = Array.isArray(rows2) ? rows2[0] : rows2;
      if (!row) return;
      this.settings = {
        show_timer: row.show_timer === void 0 || row.show_timer === null ? DEFAULT_SETTINGS.show_timer : truthy(row.show_timer),
        color_coding_enabled: row.color_coding_enabled === void 0 || row.color_coding_enabled === null ? DEFAULT_SETTINGS.color_coding_enabled : truthy(row.color_coding_enabled),
        sound_enabled: row.sound_enabled === void 0 || row.sound_enabled === null ? DEFAULT_SETTINGS.sound_enabled : truthy(row.sound_enabled),
        // kitchen#70 · the pass on paper. A hub on an older row (the column existed long before it
        // was read) falls back to OFF, never to «print», so an upgrade never starts spitting paper.
        auto_print_tickets: row.auto_print_tickets === void 0 || row.auto_print_tickets === null ? DEFAULT_SETTINGS.auto_print_tickets : truthy(row.auto_print_tickets),
        warning_time_minutes: Number(row.warning_time_minutes ?? DEFAULT_SETTINGS.warning_time_minutes) || DEFAULT_SETTINGS.warning_time_minutes,
        critical_time_minutes: Number(row.critical_time_minutes ?? DEFAULT_SETTINGS.critical_time_minutes) || DEFAULT_SETTINGS.critical_time_minutes,
        // kitchen#72 · zero is a legitimate volume, so `|| default` would silently un-mute a
        // kitchen that chose silence: only a value that is not a number falls back.
        sound_volume: volumeOf(row.sound_volume),
        sound_tone: toneOf(row.sound_tone)
      };
    } catch {
    }
  }
  async load() {
    this.loading = true;
    try {
      const [rows2, allDay, stations, waiters] = await Promise.all([
        erplora().query("kitchen.orders.display"),
        erplora().query("kitchen.orders.all_day"),
        // kitchen#45: names in the hub's language. Optional: without it (no permission, no SDK)
        // the frozen snapshot names still paint — degraded, never broken.
        erplora().query("kitchen.stations.list").catch(() => []),
        // kitchen#63: the people behind `waiter_id`. Same door `sales` uses (`hub.users.list`,
        // ADR-0192) and the same policy on failure: the pass keeps working and the header says
        // nothing, because a UUID on the card would be worse than a blank.
        erplora().query("hub.users.list").catch(() => [])
      ]);
      this.rows = Array.isArray(rows2) ? rows2 : [];
      this.ringForArrivals();
      this.allDay = Array.isArray(allDay) ? allDay : [];
      this.stationsById = new Map((Array.isArray(stations) ? stations : []).map((s5) => [String(s5.id), s5]));
      this.waitersById = new Map(
        (Array.isArray(waiters) ? waiters : []).filter((u5) => u5 && u5.id && String(u5.name ?? "").trim()).map((u5) => [String(u5.id), String(u5.name).trim()])
      );
    } catch (e5) {
      this.error = errorText(e5, "ui.loadError");
    } finally {
      this.loading = false;
    }
  }
  /**
   * Rings once when the feed brings a ticket this board had not seen (kitchen#48).
   *
   * ARRIVAL, not presence: the board reloads on every bump, recall and status change, so «there
   * are tickets» is not news — «there is a ticket that was not here a moment ago» is. And the
   * FIRST feed never rings: a KDS opened halfway through a service would otherwise greet whoever
   * turns it on with an alarm for orders already being cooked.
   *
   * One chime per reload, however many tickets landed together: a delivery burst that beeps six
   * times is the noise the Square forum complains about, not an alert.
   */
  ringForArrivals() {
    const onScreen = new Set(this.rows.map((r6) => String(r6.order_id ?? "")));
    const known = this.knownTickets;
    this.knownTickets = onScreen;
    if (!known) return;
    if (!this.settings.sound_enabled) return;
    for (const id of onScreen) {
      if (!known.has(id)) {
        this.chime.play({ volume: this.settings.sound_volume, tone: this.settings.sound_tone });
        return;
      }
    }
  }
  /**
   * Puts the PASS of a bumped ticket on paper (kitchen#70) — the sheet that leaves with the food.
   *
   * Driven by `kitchen.order.ready`, not by the tap: a ticket goes ready when the LAST line still
   * cooking is bumped, and that bump may happen on another station's screen, or from the ERP list.
   * The `jobId` carries the (order, role) pair, so every mounted board asking for the same pass is
   * one sheet in the queue, not one per screen.
   *
   * Never awaited by the event handler and never able to throw: the board reloads regardless.
   */
  async printPassFor(payload) {
    if (!this.settings.auto_print_tickets) return;
    const orderId = orderIdOf(payload);
    if (!orderId) return;
    const outcome = await printPass(orderId, erplora(), {
      // The board already resolved the hub's people for the card (kitchen#63) — asking again for
      // every pass would be a query per bump for a name we are holding.
      resolveWaiter: (id) => this.waitersById.get(id) ?? ""
    });
    if (outcome.ok) {
      this.passWarning = "";
      return;
    }
    if (outcome.reason === "no_gate") {
      console.warn("[kitchen] this shell exposes no print door: the pass cannot be printed");
      return;
    }
    this.passWarning = erplora().t(CATALOG, "ui.passPrintFailed");
  }
  // ── derived ────────────────────────────────────────────────────────────────
  get tickets() {
    return groupTickets(this.rows);
  }
  /** The station's name in the hub's language, with the line's frozen snapshot as the fallback:
   *  the station may carry no translation, be deleted, or the list may not have loaded. */
  stationName(l3) {
    const row = l3.station_id ? this.stationsById.get(l3.station_id) : void 0;
    if (!row) return l3.station;
    return String(row.name_es || row.name || l3.station);
  }
  /** kitchen#63 · the NAME of the waiter who fired this round, or '' when there is none to show.
   *
   *  '' covers three cases on purpose, and all three paint the same nothing: the round carries no
   *  waiter (an old ticket, a fire with no session), the hub does not list that id any more, or the
   *  list could not be loaded. A raw id would be worse than a blank — the cook reads it from two
   *  metres away, cannot use it, and stops trusting the header. */
  waiterName(t7) {
    return t7.waiter_id && this.waitersById.get(t7.waiter_id) || "";
  }
  /** The stations present on the line, for the segment: keyed by ID (stable across renames and
   *  locale switches), labelled in the hub's language. '' = lines without a station. */
  get stations() {
    const byId = /* @__PURE__ */ new Map();
    for (const t7 of this.tickets)
      for (const l3 of t7.lines) {
        const key = l3.station_id ?? "";
        if (!byId.has(key)) byId.set(key, this.stationName(l3));
      }
    return Array.from(byId, ([id, label]) => ({ id, label })).sort(
      (a3, b3) => a3.id === "" ? 1 : b3.id === "" ? -1 : a3.label.localeCompare(b3.label)
    );
  }
  /** The tickets this screen shows at all: the station's, or every one in the expo view. */
  get visibleTickets() {
    return this.tickets.filter((t7) => this.visibleLines(t7).length > 0 || !this.station && t7.lines.length === 0);
  }
  /** The active board: what the kitchen still has to cook. */
  get cookingTickets() {
    return this.visibleTickets.filter((t7) => t7.status !== "ready");
  }
  /** Done and waiting to be picked up. Out of the active board, one tap away (kitchen#60). The
   *  divider is the SERVER's ticket status, which is what closes the ticket when its last line is
   *  bumped — the screen does not get to decide when a ticket is finished. */
  get readyTickets() {
    return this.visibleTickets.filter((t7) => t7.status === "ready");
  }
  /** The lines of a ticket this screen shows: all of them (expo) or the station's. */
  visibleLines(t7) {
    if (!this.station) return t7.lines;
    const wantNone = this.station === NO_STATION;
    return t7.lines.filter((l3) => (l3.station_id ?? "") === (wantNone ? "" : this.station));
  }
  elapsed(t7) {
    const since = Date.parse(t7.since);
    return Number.isFinite(since) ? Math.max(0, this.now - since) : 0;
  }
  // ── actions (one tap, no dialogs) ──────────────────────────────────────────
  /** Runs one command (given as a thunk so the SDK call keeps its literal name, ADR-0127). */
  async run(cmd) {
    this.error = "";
    try {
      await cmd();
    } catch (e5) {
      this.error = errorText(e5, "ui.updateStatusError");
    }
    await this.load().catch(() => void 0);
  }
  tapLine(t7, l3) {
    if (!can("kitchen.change_order")) return;
    if (COOKING.includes(l3.status)) return this.run(() => erplora().command("kitchen.items.bump", { order_id: t7.id, item_ids: [l3.id] }));
    if (l3.status === "ready") return this.run(() => erplora().command("kitchen.items.recall", { order_id: t7.id, item_ids: [l3.id] }));
    return void 0;
  }
  /** Header tap / Bump button: every line ON SCREEN still cooking (station-scoped). */
  bumpTicket(t7) {
    if (!can("kitchen.change_order")) return;
    const ids = this.visibleLines(t7).filter((l3) => COOKING.includes(l3.status)).map((l3) => l3.id);
    if (!ids.length) return;
    return this.run(() => erplora().command("kitchen.items.bump", { order_id: t7.id, item_ids: ids }));
  }
  /**
   * kitchen#57 · header tap on a MENU: every component of THAT menu on screen, and nothing else.
   * Bumping a menu is not bumping the ticket — the à-la-carte croquetas next to it stay put.
   */
  bumpGroup(t7, g3) {
    if (!can("kitchen.change_order")) return;
    const ids = g3.lines.filter((l3) => COOKING.includes(l3.status)).map((l3) => l3.id);
    if (!ids.length) return;
    return this.run(() => erplora().command("kitchen.items.bump", { order_id: t7.id, item_ids: ids }));
  }
  /** Recall button: every line ON SCREEN already ready comes back. */
  recallTicket(t7) {
    if (!can("kitchen.change_order")) return;
    const ids = this.visibleLines(t7).filter((l3) => l3.status === "ready").map((l3) => l3.id);
    if (!ids.length) return;
    return this.run(() => erplora().command("kitchen.items.recall", { order_id: t7.id, item_ids: ids }));
  }
  serveTicket(t7) {
    if (!can("kitchen.complete_order")) return;
    return this.run(() => erplora().command("kitchen.orders.mark_served", { order_id: t7.id }));
  }
  // ── render ─────────────────────────────────────────────────────────────────
  renderLine(t7, l3) {
    const t_ = (k2) => erplora().t(CATALOG, k2);
    const actionable = can("kitchen.change_order") && (COOKING.includes(l3.status) || l3.status === "ready");
    const seat = l3.seat !== null ? b2`<span>${t_("ui.seat")} ${l3.seat}</span>` : A;
    const station = !this.station && l3.station_id ? b2`<span>${this.stationName(l3)}</span>` : A;
    const printer = l3.destination === "printer" ? b2`<ion-icon name="print-outline" aria-label=${t_("ui.printerOnly")}></ion-icon>` : A;
    return b2`<li class="line" data-item=${l3.id} data-status=${l3.status} role="button" tabindex=${actionable ? 0 : -1}
        aria-disabled=${actionable ? "false" : "true"}
        aria-label=${`${formatQty(l3.quantity, erplora().locale)} \xD7 ${l3.product_name} \u2014 ${l3.status === "ready" ? t_("ui.tapToRecall") : t_("ui.tapToBump")}`}
        @click=${() => this.tapLine(t7, l3)}
        @keydown=${(e5) => {
      if (e5.key === "Enter" || e5.key === " ") {
        e5.preventDefault();
        this.tapLine(t7, l3);
      }
    }}>
      <span class="qty">${formatQty(l3.quantity, erplora().locale)}</span>
      <span class="body">
        <div class="name">${l3.product_name}</div>
        ${l3.modifiers ? b2`<div class="mods">${l3.modifiers}</div>` : A}
        ${l3.notes ? b2`<div class="note">${l3.notes}</div>` : A}
        ${seat !== A || station !== A || printer !== A ? b2`<div class="meta">${seat}${station}${printer}</div>` : A}
      </span>
      ${l3.status === "ready" ? b2`<span class="tick" aria-hidden="true">✓</span>` : A}
    </li>`;
  }
  /**
   * A menu: its name as a quiet header, its components LISTED under it, indented behind a rule.
   *
   * The two typographic calls are ours and no product publishes them (checked across Toast,
   * Square, Lightspeed, Odoo, Revel, Clover, TouchBistro, Fresh KDS, LS Central and Simphony).
   * What the market DOES say is where the emphasis goes: Revel prints modifiers in red and Fresh
   * styles by keyword — highlighting is for allergens and changes, never for hierarchy. So the
   * header stays QUIET and the weight stays on the dish, which is what gets cooked. What the
   * forum says is what not to do, and that is the flat paragraph.
   *
   * The header is painted at EVERY station that receives a piece of the menu: `lines` is already
   * station-scoped, and a cook at the grill who cannot read «MENU» has no way to know their steak
   * is coupled to a gazpacho. It is Simphony's `11 - Send to Combo Parent Order Devices` as a
   * default instead of a switch, and Toast's headerless alternative is a mode you opt into.
   */
  renderGroup(t7, g3) {
    const t_ = (k2, p4) => erplora().t(CATALOG, k2, p4);
    if (!g3.ref) return g3.lines.map((l3) => this.renderLine(t7, l3));
    const cooking = g3.lines.some((l3) => COOKING.includes(l3.status));
    const done = g3.lines.every((l3) => l3.status === "ready");
    const actionable = can("kitchen.change_order") && cooking;
    return b2`<li class="combo" data-combo=${g3.ref} data-combo-done=${done ? "true" : "false"}>
      <div class="combo-head" role=${actionable ? "button" : "presentation"} tabindex=${actionable ? 0 : -1}
          aria-disabled=${actionable ? "false" : "true"}
          title=${actionable ? t_("ui.tapMenuToBump") : ""}
          aria-label=${t_("ui.comboAria", { name: g3.name, n: g3.lines.length })}
          @click=${() => actionable ? this.bumpGroup(t7, g3) : void 0}
          @keydown=${(e5) => {
      if (actionable && (e5.key === "Enter" || e5.key === " ")) {
        e5.preventDefault();
        this.bumpGroup(t7, g3);
      }
    }}>
        <span class="combo-name">${g3.name || t_("ui.comboFallbackName")}</span>
        <span class="combo-count">${t_("ui.comboCount", { n: g3.lines.length })}</span>
        ${done ? b2`<span class="tick" aria-hidden="true">✓</span>` : A}
      </div>
      <ul class="combo-lines">${g3.lines.map((l3) => this.renderLine(t7, l3))}</ul>
    </li>`;
  }
  renderTicket(t7) {
    const t_ = (k2, p4) => erplora().t(CATALOG, k2, p4);
    const lines = this.visibleLines(t7);
    const cooking = lines.some((l3) => COOKING.includes(l3.status));
    const struck = lines.some((l3) => l3.status === "ready");
    const canChange = can("kitchen.change_order");
    const canServe = can("kitchen.complete_order");
    const elapsed = this.elapsed(t7);
    const sem = semaphore(elapsed, this.settings);
    const waiter = this.waiterName(t7);
    const short = t7.number.includes("-") ? t7.number.slice(t7.number.lastIndexOf("-") + 1) : t7.number;
    return b2`<article class="card" data-order=${t7.id} data-status=${t7.status} data-sem=${sem} aria-label=${t_("ui.ticketAria", { n: short })}>
      <header class="head" role="button" tabindex=${canChange && cooking ? 0 : -1} aria-disabled=${canChange && cooking ? "false" : "true"}
          title=${canChange && cooking ? t_("ui.tapHeaderToBump") : ""}
          @click=${() => cooking ? this.bumpTicket(t7) : void 0}
          @keydown=${(e5) => {
      if (cooking && (e5.key === "Enter" || e5.key === " ")) {
        e5.preventDefault();
        this.bumpTicket(t7);
      }
    }}>
        <span class="title">
          <span class="label">${t7.label || t_(`ui.orderType_${t7.order_type}`) || t7.order_type}</span>
          ${waiter ? b2`<span class="waiter" data-waiter>${t_("ui.firedBy", { name: waiter })}</span>` : A}
        </span>
        ${t7.priority !== "normal" ? b2`<span class="pill ${t7.priority}">${t_(`ui.priority_${t7.priority}`)}</span>` : A}
        ${t7.round > 1 ? b2`<span class="pill round">${t_("ui.round", { n: t7.round })}</span>` : A}
        ${t7.status === "ready" ? b2`<span class="pill ready">${t_("ui.statusReady")}</span>` : A}
        ${this.settings.show_timer ? b2`<span class="timer" data-timer>${formatElapsed(elapsed)}</span>` : A}
        <span class="num">#${short}</span>
      </header>
      <ul class="lines">${groupCombos(lines).map((g3) => this.renderGroup(t7, g3))}</ul>
      ${t7.notes ? b2`<div class="notes">${t7.notes}</div>` : A}
      ${canChange || canServe && t7.status === "ready" ? b2`<footer class="foot">
            ${canChange && cooking ? b2`<ion-button data-action="bump" @click=${() => this.bumpTicket(t7)}>${t_("ui.bump")}</ion-button>` : A}
            ${canChange && struck ? b2`<ion-button data-action="recall" fill="outline" @click=${() => this.recallTicket(t7)}>${t_("ui.recall")}</ion-button>` : A}
            ${canServe && t7.status === "ready" ? b2`<ion-button data-action="served" fill="outline" @click=${() => this.serveTicket(t7)}>${t_("ui.rowMarkServed")}</ion-button>` : A}
          </footer>` : A}
    </article>`;
  }
  /** ONE grid of equal columns, or the empty state. Never two grids stacked down the page. */
  renderBoard(tickets, emptyKey) {
    const t_ = (k2) => erplora().t(CATALOG, k2);
    if (!tickets.length) return b2`<ok-empty-state icon="restaurant-outline" .title=${t_(emptyKey)}></ok-empty-state>`;
    return b2`<div class="grid">${tickets.map((t7) => this.renderTicket(t7))}</div>`;
  }
  /** An All-Day row's station name, in the hub's language: rows group by the FROZEN name, so this
   *  reverses it through the stations list (a row frozen as `Bar` or as `Barra` both render
   *  «Barra»). Unknown names (station deleted, list not loaded) stay as they were frozen. */
  allDayStation(name) {
    const frozen = String(name ?? "");
    if (!frozen) return frozen;
    for (const s5 of this.stationsById.values()) {
      if (frozen === s5.name_es || frozen === s5.name) return String(s5.name_es || s5.name);
    }
    return frozen;
  }
  renderAllDay() {
    const t_ = (k2) => erplora().t(CATALOG, k2);
    let rows2 = this.allDay;
    if (this.station) {
      const selected = this.station === NO_STATION ? null : this.stationsById.get(this.station);
      const names = selected ? /* @__PURE__ */ new Set([String(selected.name_es || ""), String(selected.name || "")]) : /* @__PURE__ */ new Set([""]);
      rows2 = this.allDay.filter((r6) => names.has(String(r6.station_name ?? "")));
    }
    if (!rows2.length) return b2`<ok-empty-state icon="restaurant-outline" .title=${t_("ui.emptyAllDay")}></ok-empty-state>`;
    return b2`<table class="allday">
      <thead><tr><th>${t_("ui.colProduct")}</th><th></th><th></th></tr></thead>
      <tbody>${rows2.map(
      (r6) => b2`<tr data-allday=${r6.product_name}>
          <td>${r6.product_name}</td>
          <td class="s">${!this.station && r6.station_name ? this.allDayStation(r6.station_name) : ""}</td>
          <td class="q">${formatQty(Number(r6.quantity) || 0, erplora().locale)}</td>
        </tr>`
    )}</tbody>
    </table>`;
  }
  /** Chrome controls the shell says it honours here (`chrome="fullscreen …"`). */
  get chromeControls() {
    return this.chrome.split(/\s+/).filter(Boolean);
  }
  /**
   * Asks the SHELL for a chrome control (ADR-0048: the module is content, the chrome is the
   * shell's). `composed` to leave the shadow root and `bubbles` to reach the module host — without
   * both the request dies inside the component. Nothing is toggled here: whoever does not listen
   * does not answer, which is why the button is not painted unless the capability was announced.
   */
  requestChrome(control) {
    this.dispatchEvent(new CustomEvent("erp:chrome-request", {
      detail: { control, action: "toggle" },
      bubbles: true,
      composed: true
    }));
  }
  renderFullscreen() {
    const t_ = (k2) => erplora().t(CATALOG, k2);
    if (!this.chromeControls.includes("fullscreen")) return A;
    const label = t_(this.fullscreen ? "ui.exitFullscreen" : "ui.fullscreen");
    return b2`<button type="button" class="fs" data-action="fullscreen" title=${label} aria-label=${label}
        @click=${() => this.requestChrome("fullscreen")}>
      <ion-icon name=${this.fullscreen ? "contract-outline" : "expand-outline"} aria-hidden="true"></ion-icon>
    </button>`;
  }
  render() {
    const t_ = (k2) => erplora().t(CATALOG, k2);
    const stations = this.stations;
    const cooking = this.cookingTickets;
    const ready = this.readyTickets;
    return b2`<div>
      <div class="bar">
        <ion-segment class="views" .value=${this.mode} @ionChange=${(e5) => this.mode = e5.detail.value || "tickets"}>
          <ion-segment-button value="tickets"><ion-label>${t_("ui.modeTickets")}<span class="count" data-count="cooking">${cooking.length}</span></ion-label></ion-segment-button>
          <ion-segment-button value="ready"><ion-label>${t_("ui.readyRail")}<span class="count" data-count="ready">${ready.length}</span></ion-label></ion-segment-button>
          <ion-segment-button value="allday"><ion-label>${t_("ui.modeAllDay")}</ion-label></ion-segment-button>
        </ion-segment>
        ${this.renderFullscreen()}
        ${stations.length > 1 || this.station ? b2`<ion-segment class="stations" scrollable .value=${this.station || "__all"} @ionChange=${(e5) => this.station = e5.detail.value === "__all" ? "" : String(e5.detail.value ?? "")}>
              <ion-segment-button value="__all"><ion-label>${t_("ui.stationAll")}</ion-label></ion-segment-button>
              ${stations.map((s5) => b2`<ion-segment-button value=${s5.id || NO_STATION}><ion-label>${s5.id ? s5.label : t_("ui.stationNone")}</ion-label></ion-segment-button>`)}
            </ion-segment>` : A}
      </div>
      ${this.error ? b2`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.error}</ok-inline-feedback>` : A}
      ${this.passWarning ? b2`<ok-inline-feedback data-pass-warning tone="warning" icon="print-outline">${this.passWarning}</ok-inline-feedback>` : A}
      ${this.mode === "allday" ? this.renderAllDay() : this.mode === "ready" ? this.renderBoard(ready, "ui.emptyReady") : this.renderBoard(cooking, "ui.emptyDisplay")}
    </div>`;
  }
};
__decorateClass([
  n4({ type: String, reflect: true })
], ErpKitchenDisplay.prototype, "station", 2);
__decorateClass([
  n4({ type: String, reflect: true })
], ErpKitchenDisplay.prototype, "mode", 2);
__decorateClass([
  n4()
], ErpKitchenDisplay.prototype, "chrome", 2);
__decorateClass([
  n4({ type: Boolean })
], ErpKitchenDisplay.prototype, "fullscreen", 2);
__decorateClass([
  r5()
], ErpKitchenDisplay.prototype, "rows", 2);
__decorateClass([
  r5()
], ErpKitchenDisplay.prototype, "allDay", 2);
__decorateClass([
  r5()
], ErpKitchenDisplay.prototype, "settings", 2);
__decorateClass([
  r5()
], ErpKitchenDisplay.prototype, "stationsById", 2);
__decorateClass([
  r5()
], ErpKitchenDisplay.prototype, "waitersById", 2);
__decorateClass([
  r5()
], ErpKitchenDisplay.prototype, "error", 2);
__decorateClass([
  r5()
], ErpKitchenDisplay.prototype, "passWarning", 2);
__decorateClass([
  r5()
], ErpKitchenDisplay.prototype, "loading", 2);
__decorateClass([
  r5()
], ErpKitchenDisplay.prototype, "now", 2);
define("erp-kitchen-display", ErpKitchenDisplay);

// lit-html/directive.js
var t3 = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 };
var e4 = (t7) => (...e5) => ({ _$litDirective$: t7, values: e5 });
var i4 = class {
  constructor(t7) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t7, e5, i7) {
    this._$Ct = t7, this._$AM = e5, this._$Ci = i7;
  }
  _$AS(t7, e5) {
    return this.update(t7, e5);
  }
  update(t7, e5) {
    return this.render(...e5);
  }
};

// lit-html/directive-helpers.js
var { I: t4 } = j;
var i5 = (o7) => o7;
var s4 = () => document.createComment("");
var v2 = (o7, n6, e5) => {
  const l3 = o7._$AA.parentNode, d3 = void 0 === n6 ? o7._$AB : n6._$AA;
  if (void 0 === e5) {
    const i7 = l3.insertBefore(s4(), d3), n7 = l3.insertBefore(s4(), d3);
    e5 = new t4(i7, n7, o7, o7.options);
  } else {
    const t7 = e5._$AB.nextSibling, n7 = e5._$AM, c5 = n7 !== o7;
    if (c5) {
      let t8;
      e5._$AQ?.(o7), e5._$AM = o7, void 0 !== e5._$AP && (t8 = o7._$AU) !== n7._$AU && e5._$AP(t8);
    }
    if (t7 !== d3 || c5) {
      let o8 = e5._$AA;
      for (; o8 !== t7; ) {
        const t8 = i5(o8).nextSibling;
        i5(l3).insertBefore(o8, d3), o8 = t8;
      }
    }
  }
  return e5;
};
var u3 = (o7, t7, i7 = o7) => (o7._$AI(t7, i7), o7);
var m3 = {};
var p3 = (o7, t7 = m3) => o7._$AH = t7;
var M2 = (o7) => o7._$AH;
var h3 = (o7) => {
  o7._$AR(), o7._$AA.remove();
};

// lit-html/directives/repeat.js
var u4 = (e5, s5, t7) => {
  const r6 = /* @__PURE__ */ new Map();
  for (let l3 = s5; l3 <= t7; l3++) r6.set(e5[l3], l3);
  return r6;
};
var c4 = e4(class extends i4 {
  constructor(e5) {
    if (super(e5), e5.type !== t3.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(e5, s5, t7) {
    let r6;
    void 0 === t7 ? t7 = s5 : void 0 !== s5 && (r6 = s5);
    const l3 = [], o7 = [];
    let i7 = 0;
    for (const s6 of e5) l3[i7] = r6 ? r6(s6, i7) : i7, o7[i7] = t7(s6, i7), i7++;
    return { values: o7, keys: l3 };
  }
  render(e5, s5, t7) {
    return this.dt(e5, s5, t7).values;
  }
  update(s5, [t7, r6, c5]) {
    const d3 = M2(s5), { values: p4, keys: a3 } = this.dt(t7, r6, c5);
    if (!Array.isArray(d3)) return this.ut = a3, p4;
    const h4 = this.ut ??= [], v3 = [];
    let m4, y3, x2 = 0, j2 = d3.length - 1, k2 = 0, w2 = p4.length - 1;
    for (; x2 <= j2 && k2 <= w2; ) if (null === d3[x2]) x2++;
    else if (null === d3[j2]) j2--;
    else if (h4[x2] === a3[k2]) v3[k2] = u3(d3[x2], p4[k2]), x2++, k2++;
    else if (h4[j2] === a3[w2]) v3[w2] = u3(d3[j2], p4[w2]), j2--, w2--;
    else if (h4[x2] === a3[w2]) v3[w2] = u3(d3[x2], p4[w2]), v2(s5, v3[w2 + 1], d3[x2]), x2++, w2--;
    else if (h4[j2] === a3[k2]) v3[k2] = u3(d3[j2], p4[k2]), v2(s5, d3[x2], d3[j2]), j2--, k2++;
    else if (void 0 === m4 && (m4 = u4(a3, k2, w2), y3 = u4(h4, x2, j2)), m4.has(h4[x2])) if (m4.has(h4[j2])) {
      const e5 = y3.get(a3[k2]), t8 = void 0 !== e5 ? d3[e5] : null;
      if (null === t8) {
        const e6 = v2(s5, d3[x2]);
        u3(e6, p4[k2]), v3[k2] = e6;
      } else v3[k2] = u3(t8, p4[k2]), v2(s5, d3[x2], t8), d3[e5] = null;
      k2++;
    } else h3(d3[j2]), j2--;
    else h3(d3[x2]), x2++;
    for (; k2 <= w2; ) {
      const e5 = v2(s5, v3[w2 + 1]);
      u3(e5, p4[k2]), v3[k2++] = e5;
    }
    for (; x2 <= j2; ) {
      const e5 = d3[x2++];
      null !== e5 && h3(e5);
    }
    return this.ut = a3, p3(s5, v3), E;
  }
});

// lit-html/directives/style-map.js
var n5 = "important";
var i6 = " !" + n5;
var o6 = e4(class extends i4 {
  constructor(t7) {
    if (super(t7), t7.type !== t3.ATTRIBUTE || "style" !== t7.name || t7.strings?.length > 2) throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.");
  }
  render(t7) {
    return Object.keys(t7).reduce((e5, r6) => {
      const s5 = t7[r6];
      return null == s5 ? e5 : e5 + `${r6 = r6.includes("-") ? r6 : r6.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g, "-$&").toLowerCase()}:${s5};`;
    }, "");
  }
  update(e5, [r6]) {
    const { style: s5 } = e5.element;
    if (void 0 === this.ft) return this.ft = new Set(Object.keys(r6)), this.render(r6);
    for (const t7 of this.ft) null == r6[t7] && (this.ft.delete(t7), t7.includes("-") ? s5.removeProperty(t7) : s5[t7] = null);
    for (const t7 in r6) {
      const e6 = r6[t7];
      if (null != e6) {
        this.ft.add(t7);
        const r7 = "string" == typeof e6 && e6.endsWith(i6);
        t7.includes("-") || r7 ? s5.setProperty(t7, r7 ? e6.slice(0, -11) : e6, r7 ? n5 : "") : s5[t7] = e6;
      }
    }
    return E;
  }
});

// @erplora/outfitkit/dist/ok-data-table.js
var CSV_BOM = "\uFEFF";
var WINDOWS_1252_C1 = [
  8364,
  129,
  8218,
  402,
  8222,
  8230,
  8224,
  8225,
  710,
  8240,
  352,
  8249,
  338,
  141,
  381,
  143,
  144,
  8216,
  8217,
  8220,
  8221,
  8226,
  8211,
  8212,
  732,
  8482,
  353,
  8250,
  339,
  157,
  382,
  376
];
function decodeWindows1252(bytes) {
  let text = "";
  for (const byte of bytes) {
    text += String.fromCharCode(byte >= 128 && byte <= 159 ? WINDOWS_1252_C1[byte - 128] : byte);
  }
  return text;
}
function decodeCsvBuffer(buf) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = decodeWindows1252(new Uint8Array(buf));
  }
  return text.charCodeAt(0) === 65279 ? text.slice(1) : text;
}
var __defProp4 = Object.defineProperty;
var __decorateClass4 = (decorators, target, key, kind) => {
  var result = void 0;
  for (var i7 = decorators.length - 1, decorator; i7 >= 0; i7--)
    if (decorator = decorators[i7])
      result = decorator(target, key, result) || result;
  if (result) __defProp4(target, key, result);
  return result;
};
var DEFAULT_LABELS2 = {
  search: "Search\u2026",
  empty: "No results",
  filters: "Filters",
  clear: "Clear",
  apply: "Apply",
  selected: "{n} selected",
  importCsv: "Import CSV",
  exportCsv: "Export CSV",
  add: "Add",
  moreActions: "More actions",
  rowsPerPage: "Rows per page",
  perPageShort: "{n} / page",
  viewList: "View as list",
  viewCards: "View as cards",
  columnsVisible: "Visible columns",
  columns: "Columns",
  actions: "Actions",
  close: "Close",
  newRecord: "New",
  form: "Form",
  filterPlaceholder: "Filter\u2026",
  from: "From",
  to: "To",
  fromOf: "{label} from",
  toOf: "{label} to",
  gte: "\u2265",
  lte: "\u2264",
  noValues: "No values",
  selectAll: "Select all",
  selectRow: "Select row",
  select: "Select",
  showing: "Showing {from}\u2013{to} of",
  recordSingular: "record",
  recordPlural: "records",
  loadMore: "Load more"
};
var ES_LABELS = {
  search: "Buscar\u2026",
  empty: "Sin resultados",
  filters: "Filtros",
  clear: "Limpiar",
  apply: "Aplicar",
  selected: "{n} seleccionados",
  importCsv: "Importar CSV",
  exportCsv: "Exportar CSV",
  add: "A\xF1adir",
  moreActions: "M\xE1s acciones",
  rowsPerPage: "Filas por p\xE1gina",
  perPageShort: "{n} / p\xE1g.",
  viewList: "Vista lista",
  viewCards: "Vista tarjetas",
  columnsVisible: "Columnas visibles",
  columns: "Columnas",
  actions: "Acciones",
  close: "Cerrar",
  newRecord: "Nuevo",
  form: "Formulario",
  filterPlaceholder: "Filtrar\u2026",
  from: "Desde",
  to: "Hasta",
  fromOf: "{label} desde",
  toOf: "{label} hasta",
  gte: "\u2265",
  lte: "\u2264",
  noValues: "Sin valores",
  selectAll: "Seleccionar todo",
  selectRow: "Seleccionar fila",
  select: "Seleccionar",
  showing: "Mostrando {from}\u2013{to} de",
  recordSingular: "registro",
  recordPlural: "registros",
  loadMore: "Cargar m\xE1s"
};
var _OkDataTable = class _OkDataTable2 extends i3 {
  constructor() {
    super(...arguments);
    this.columns = [];
    this.rows = [];
    this.searchKeys = [];
    this.rowKeyField = "id";
    this.pageSize = 10;
    this.labels = {};
    this.actions = [];
    this.addable = false;
    this.pageSizeOptions = [10, 25, 50, 100];
    this.fill = false;
    this.columnPicker = true;
    this.csv = false;
    this.csvName = "export.csv";
    this.serverSide = false;
    this.total = 0;
    this.page = 0;
    this.searchable = false;
    this.sortDir = "asc";
    this.filterValues = {};
    this.title = "";
    this.views = false;
    this.exportable = false;
    this.importable = false;
    this.columnSelector = false;
    this.rowClickable = false;
    this.selectable = false;
    this.inlineFilters = false;
    this.menuActions = [];
    this.q = "";
    this.clientPage = 0;
    this.clientPageSize = 0;
    this.mobileShown = 0;
    this.clientSort = "";
    this.clientSortDir = "asc";
    this.clientFilters = {};
    this.filterDraft = {};
    this.serverFilters = {};
    this.panel = "none";
    this.viewMode = "table";
    this.viewChosenByUser = false;
    this.isMobile = false;
    this.xOverflow = false;
    this.hiddenKeys = /* @__PURE__ */ new Set();
    this.internalSelection = /* @__PURE__ */ new Set();
    this.menuOpen = false;
    this.onLocaleChanged = () => this.requestUpdate();
    this.onWindowResize = () => this.measureXOverflow();
    this.onSearch = (ev) => {
      const value = ev.target.value ?? "";
      if (this.serverSide) {
        this.emit("searchChange", value);
      } else {
        this.q = value;
        this.clientPage = 0;
        this.mobileShown = 0;
      }
    };
  }
  static {
    this.styles = i`
    :host {
      /* Vars overridable (estilo Ionic), default = cadena --ok-* → --ion-* → hex */
      --background: var(--ok-surface, var(--ion-card-background, var(--ion-background-color, #ffffff)));
      --color: var(--ok-text, var(--ion-text-color, #1c1b17));
      --color-muted: var(--ok-muted, var(--ion-color-medium, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.55)));
      --border-color: var(--ok-border, var(--ion-color-step-150, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.12)));
      --border-color-soft: var(--ok-border-soft, var(--ion-color-step-100, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.07)));
      /* Borde más marcado para los controles de la toolbar (selects/pastilla de fechas), para que se
       * distingan como controles en claro y oscuro aunque el lienzo y la superficie casi no contrasten. */
      --control-border: color-mix(in srgb, var(--color) 22%, transparent);
      /* Relieve de cabecera/pie: step-100 (definido en claro y oscuro) → contraste con el lienzo. */
      --header-background: var(--ok-surface-2, var(--ion-color-step-100, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.04)));
      --row-hover: var(--ok-row-hover, var(--ion-color-step-50, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.03)));
      --primary: var(--ok-primary, var(--ion-color-primary, #3880ff));
      --primary-contrast: var(--ok-primary-contrast, var(--ion-color-primary-contrast, #ffffff));
      --border-radius: var(--ok-radius, 16px);
      --font: var(--ok-font, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);

      display: block;
      color: var(--color);
      font-family: var(--font);
    }
    * { box-sizing: border-box; }
    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      /* Flat: sin borde ni elevación (directiva 2026-06-09). */
      border: 0;
      border-radius: var(--border-radius);
      overflow: hidden;
      background: var(--background);
      box-shadow: none;
    }

    /* Panel lateral derecho (drawer) DENTRO de la tabla: filtros / alta-edición. Base (sin media):
       overlay absoluto — es lo que había hasta #75 y lo que ve un navegador sin media queries. */
    .tk-scrim { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.18); z-index: 19; }
    .drawer { position: absolute; top: 0; right: 0; height: 100%; width: 340px; max-width: 88%;
      background: var(--background); border-left: 1px solid var(--border-color);
      display: flex; flex-direction: column; z-index: 20;
      animation: tk-slide-in 0.18s ease; }
    @keyframes tk-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
    /* #75 — El panel EMPUJA en escritorio y es HOJA COMPLETA en móvil; nunca tapa a medias.
       Medido en el hub (Servicios/Citas): a 1440 el overlay de 340px se pintaba ENCIMA de
       «Duración», «Acciones» y el selector de columnas, con el 90% de la tabla vacío a la
       izquierda; a 390 dejaba una tira de 45px de tabla (media lupa, medio «Co…») que hacía
       parecer el formulario un pop-up mal puesto. Square Dashboard reduce la tabla con un panel
       fijo; Fresha/Shopify/Odoo abren una hoja a pantalla completa en móvil.
       ≥ 834px: mientras hay panel, .card pasa a rejilla de DOS columnas (tabla | panel 360px):
       la tabla se estrecha (ya sabe hacer scroll-x, #67) y nada queda tapado. */
    @media (min-width: 834px) {
      .card.has-panel { display: grid; grid-template-columns: minmax(0, 1fr) 360px; grid-template-rows: auto minmax(0, 1fr) auto; }
      .card.has-panel > .bar { grid-column: 1; grid-row: 1; }
      .card.has-panel > .scroll, .card.has-panel > .cards-grid, .card.has-panel > .empty { grid-column: 1; grid-row: 2; min-height: 0; overflow: auto; }
      .card.has-panel > .pager { grid-column: 1; grid-row: 3; }
      .card.has-panel > .drawer { position: static; grid-column: 2; grid-row: 1 / -1; width: auto; max-width: none; height: auto; min-height: 0; animation: none; }
      .card.has-panel > .tk-scrim { display: none; }
    }
    /* < 834px: hoja a pantalla completa con su cabecera (título + Cerrar); sin tira residual.
       position:fixed dentro de ion-content se ancla al área de contenido (contain), que es justo el hueco
       bajo la cabecera de la app: el usuario conserva el título de la página. */
    @media (max-width: 833.98px) {
      .drawer { position: fixed; inset: 0; top: var(--ok-sheet-top, 0px); width: 100%; max-width: none; height: auto; border-left: 0; z-index: 1000; }
      .tk-scrim { display: none; }
    }
    .drawer .dh { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
      padding: 0.6rem 0.5rem 0.6rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 1rem; }
    .drawer .db { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem; }
    .fblock { display: flex; flex-direction: column; gap: 0.45rem; }
    .flabel { font-size: 13px; font-weight: 500; color: var(--color); }
    .frange { display: flex; gap: 0.5rem; }
    /* Filtros cliente: multi-select con ion-select (ventana flotante de Ionic) + rango de fechas. */
    .daterange { display: flex; gap: 0.6rem; }
    .daterange ion-input { flex: 1; }
    /* Pie del drawer de filtros: Limpiar / Aplicar. */
    .df { flex: 0 0 auto; display: flex; align-items: center; justify-content: flex-end; gap: 0.4rem; padding: 0.6rem 0.85rem; border-top: 1px solid var(--border-color); }
    .df .df-clear { margin-right: auto; }

    /* Modo fill: la tabla ocupa el alto del contenedor; filas con scroll interno; pager fijo. */
    :host([fill]) { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    :host([fill]) .card { flex: 1 1 auto; min-height: 0; }
    :host([fill]) .bar, :host([fill]) .panel, :host([fill]) .pager { flex: 0 0 auto; }
    :host([fill]) .scroll, :host([fill]) .cards-grid { flex: 1 1 auto; min-height: 0; overflow: auto; }
    /* Sin filas, renderTable/renderCards devuelven SOLO el bloque .empty (sin .scroll). En modo
       fill hay que estirarlo para que ocupe el hueco entre toolbar y pager y centre su contenido
       (icono + mensaje) en vertical; si no, queda pegado arriba con el pager a media altura. */
    :host([fill]) .empty { flex: 1 1 auto; min-height: 0; }

    /* ── Topbar / cabecera (relieve) ─────────────────────────────────────────────────────── */
    .bar { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.65rem 1rem; border-bottom: 1px solid var(--border-color); background: var(--header-background); }
    /* Toolbar CONSOLIDADA: TODOS los controles son hijos directos de UNA sola fila flex que
     * envuelve ELEMENTO A ELEMENTO (no por bloques): caben en una línea → una línea; los que no
     * caben bajan a la(s) línea(s) que hagan falta. El cluster derecho se empuja al borde con
     * .tk-spacer (hueco flexible) solo cuando todo cabe en una línea; al envolver, el spacer se
     * oculta y todo se apila a la izquierda.
     * ORDEN CANÓNICO (2026-06-22, izquierda→derecha): [buscador] · [filtros en línea] · ‹spacer› ·
     * [SELECTORES: columnas → filas/página] · [BOTONES: vistas → filtros(funnel) → import → export →
     * alta → ⋮ → acción primaria]. Es decir: buscador al inicio, filtros en medio, y al final los
     * selectores (columnas, luego «N por página») seguidos de los botones de acción. */
    .bar-main { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    .bar-main > ion-button { --padding-start: 0.5rem; --padding-end: 0.5rem; margin: 0; }
    /* Spacer que absorbe el hueco libre en pantallas anchas (empuja el cluster derecho al borde).
     * Se oculta por debajo de 1024px para que, al envolver, los controles se apilen a la izquierda. */
    .tk-spacer { flex: 1 1 0; min-width: 0; align-self: stretch; }
    @media (max-width: 1024px) { .tk-spacer { display: none; } }
    /* Buscador a ancho completo (línea propia) en móvil; el resto envuelve debajo. */
    @media (max-width: 640px) { .search { flex-basis: 100%; max-width: none; } }
    .title-wrap { display: flex; align-items: baseline; gap: 0.5rem; }
    .title { font-size: 15px; font-weight: 600; line-height: 1; margin: 0; }
    .title-count { font-size: 12px; font-weight: 500; color: var(--color-muted); }

    /* Botón de herramienta cuadrado (filtros/import/export), look del Hub: 36×36, badge contador. */
    .toolbtn { position: relative; --padding-start: 0; --padding-end: 0; --border-radius: 10px; width: 36px; height: 36px; margin: 0; }
    .toolbtn .badge { position: absolute; top: -5px; right: -5px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 999px; background: var(--primary); color: var(--primary-contrast); font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; pointer-events: none; }

    /* Buscador (caja con icono + limpiar), look del Hub. No crece (el spacer se queda el hueco);
     * puede encoger hasta min-width y, por debajo, envuelve. */
    .search { flex: 0 1 22rem; min-width: 12rem; max-width: 24rem; }
    ion-searchbar { --background: var(--background); --border-radius: 10px; padding: 0; min-height: 36px; }
    /* Flat: el buscador quita borde y elevación vía la clase específica de Ionic 'ion-no-border'.
     * (La regla global de Ionic para .ion-no-border no cruza el Shadow DOM, así que la
     * reimplementamos aquí dentro: --box-shadow controla la elevación; ::part(native) el borde.) */
    ion-searchbar.ion-no-border { --box-shadow: none; }
    ion-searchbar.ion-no-border::part(native) { border: none; box-shadow: none; }

    /* Toggle de vista lista/tarjetas (segmento) */
    .viewseg { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--background); }
    .viewseg ion-button { --border-radius: 7px; }

    /* Botón primario (primaryAction) */
    .primary-btn { --background: var(--primary); --color: var(--primary-contrast); }
    /* #76 — El alta en MÓVIL: botón primario CON etiqueta y área táctil de 44px, en vez del «+»
       icónico de 36px al final de la barra. Fresha/Square/Shopify POS ponen la acción primaria
       de la lista como botón visible con texto (o FAB), nunca como icono anónimo. */
    .add-btn { min-height: 44px; --border-radius: 10px; --padding-start: 0.9rem; --padding-end: 1rem; margin: 0; font-weight: 600; }
    .add-btn ion-icon { margin-inline-end: 0.35rem; }

    /* Selects de la toolbar: fondo + borde visibles (como el buscador y la pastilla de fechas) para
     * que se distingan como controles en claro y oscuro (sin fondo eran invisibles en dark). */
    .tk-cols { min-width: 6.5rem; max-width: 9rem; min-height: 38px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.3rem; --padding-bottom: 0.3rem; }
    .vsep { width: 1px; align-self: stretch; background: var(--border-color); margin: 0.3rem 0.25rem; }

    /* Selector de filas/página en la toolbar (consolidado) */
    /* max-width: ion-select es display:block (sin core.css el host estira a la
     * línea entera cuando .bar-end hace wrap) — se capa como .tk-cols. */
    .tk-psize { min-width: 4.25rem; max-width: 5.5rem; min-height: 38px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.35rem; --padding-bottom: 0.35rem; }

    /* Filtros EN LÍNEA en la toolbar (select / rango de fechas) */
    .tk-filter { min-width: 8.5rem; max-width: 13rem; min-height: 38px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.7rem; --padding-end: 0.5rem; --padding-top: 0.35rem; --padding-bottom: 0.35rem; }
    .tk-daterange { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.6rem; min-height: 38px; border: 1px solid var(--control-border); border-radius: 10px; background: var(--background); color: var(--color-muted); font-size: 13px; }
    .tk-daterange ion-icon { font-size: 15px; flex: 0 0 auto; }
    .tk-daterange ion-input { --background: transparent; --padding-start: 0; --padding-end: 0; --padding-top: 2px; --padding-bottom: 2px; --color: var(--color); min-height: 26px; width: 6.8rem; font-size: 13px; }
    .tk-daterange .arr { color: var(--color-muted); }

    /* Barra contextual de selección */
    .selbar { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.7rem; border-radius: 10px;
      font-size: 13px; color: var(--primary);
      background: color-mix(in srgb, var(--primary) 12%, transparent); }
    .selbar .sel-clear { margin-left: auto; display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; font-weight: 500; color: inherit; background: none; border: 0; font: inherit; }
    .selbar .sel-clear:hover { text-decoration: underline; }

    /* Acordeones (alta / filtros en modo tarjetas) */
    .panel { padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-color); background: var(--header-background); }
    .filters-panel { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.6rem; }

    /* ── Vista lista en CSS GRID (no <table>): permite ancho por columna ──────────────────── */
    /* #67 — La barra horizontal es PERMANENTE cuando hay desbordamiento: la overlay de macOS se
       esconde a los pocos ms y deja la tabla sin ninguna pista de que sigue a la derecha. Al
       declarar ::-webkit-scrollbar el navegador pinta la clásica, que ocupa sitio y se ve. */
    .scroll { overflow-x: auto; }
    .scroll::-webkit-scrollbar { height: 10px; }
    .scroll::-webkit-scrollbar-track { background: transparent; }
    .scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--color) 25%, transparent); border-radius: 6px; }
    .scroll::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--color) 40%, transparent); }
    .grid { min-width: max-content; font-size: 14px; }
    .grow { display: grid; align-items: center; gap: 0.5rem; padding: 0 1rem; }
    .ghead { position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--border-color);
      background: var(--header-background); padding-top: 0.55rem; padding-bottom: 0.55rem; }
    .gcell { display: flex; align-items: center; min-width: 0; }
    .gcell > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gcell.right { justify-content: flex-end; text-align: right; }
    .gcell.center { justify-content: center; text-align: center; }
    /* #67 — COLUMNA DE ACCIONES FIJADA. Con seis columnas o más la rejilla desborda por diseño
       (min-width: max-content) y el botón que abre el registro se iba fuera de la pantalla: a
       1440px quedaba a 335px del borde, sin nada que lo delatara. Se queda pegada al borde
       derecho, como en Zendesk/Freshdesk/Shopify. Con background:inherit la hereda de la fila (que
       por eso es opaca), así conserva hover y selección sin que se lea nada por debajo. */
    .gcell.actions-col { position: sticky; right: 0; z-index: 1; background: inherit;
      margin-right: -1rem; padding-right: 1rem; }
    /* La sombra solo aparece cuando de verdad hay algo escondido a la izquierda (clase x-overflow);
       si la tabla cabe entera no se pinta nada. */
    .scroll.x-overflow .gcell.actions-col { box-shadow: -10px 0 10px -10px color-mix(in srgb, var(--color) 45%, transparent); }
    .ghead .gcell.actions-col { z-index: 3; }
    .gh { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); }
    .gh.sortable { cursor: pointer; user-select: none; white-space: nowrap; transition: background-color var(--ok-transition, 150ms ease), color var(--ok-transition, 150ms ease), box-shadow var(--ok-transition, 150ms ease), transform 120ms ease; }
    @media (hover: hover) {
      .gh.sortable:hover { color: var(--color); }
    }
    /* Caret de orden (3 estados, icono Ionic): neutral atenuado / activo en color primario. */
    .caret { display: inline-flex; align-items: center; margin-left: 0.25rem; flex: 0 0 auto; font-size: 13px; opacity: 0.3; }
    .caret.on { opacity: 1; color: var(--primary); }
    .grow-data { background: var(--background); border-bottom: 1px solid var(--border-color-soft); padding-top: 0.6rem; padding-bottom: 0.6rem; transition: background-color var(--ok-transition, 150ms ease), color var(--ok-transition, 150ms ease), box-shadow var(--ok-transition, 150ms ease), transform 120ms ease; }
    .grow-data:last-child { border-bottom: 0; }
    @media (hover: hover) {
      .grow-data:hover { background: linear-gradient(var(--row-hover), var(--row-hover)), var(--background); }
    }
    .grow-data:active { transform: scale(0.995); }
    .grow-data.selected { background: linear-gradient(color-mix(in srgb, var(--primary) 10%, transparent), color-mix(in srgb, var(--primary) 10%, transparent)), var(--background); }
    /* #67 — Fila clicable (opt-in row-clickable): es lo primero que intenta el usuario y lo que
       hacen Odoo, Jira SM, Shopify o Square en sus listados. */
    .grow-data.clickable { cursor: pointer; }
    .grow-data.clickable:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
    .selcb { display: flex; align-items: center; justify-content: center; }
    .filters-grow { padding-top: 0.4rem; padding-bottom: 0.6rem; }
    .filters-grow input, .filters-grow select { width: 100%; box-sizing: border-box; font: inherit; font-size: 13px; padding: 0.3rem 0.4rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--background); color: var(--color); }
    .range { display: flex; gap: 0.25rem; }

    /* ── Vista tarjetas ──────────────────────────────────────────────────────────────────── */
    /* Cada tarjeta mide SU contenido (no se estira al alto de la fila ni del contenedor):
       - grid-auto-rows: max-content → cada fila implícita = alto de su contenido. CLAVE: sin esto,
         en modo fill (grid de alto fijo + align-content:start) cuando las tarjetas no caben el
         navegador encoge los tracks de fila y las tarjetas se solapan.
       - align-content: start → empaqueta las filas arriba (no reparte el hueco sobrante estirando).
       - align-items: start → en una fila multi-columna cada tarjeta mide su propio contenido.
       En modo fill el grid es flex-child con overflow:auto → cuando las tarjetas no caben aparece el
       scroll DENTRO de la tabla (no crece hacia fuera). */
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.75rem; padding: 1rem; grid-auto-rows: max-content; align-content: start; align-items: start; }
    /* Tarjeta = ion-card NATIVO de Ionic: su fondo, radio, elevación y padding son los de Ionic y NO
       se sobrescriben. Aquí solo se ajusta lo que el contexto de rejilla exige (margin) y los huecos
       que Ionic no trae (cabecera en fila, filas clave-valor, barra de acciones, resalte de selección). */
    ion-card.rcard { margin: 0; } /* la rejilla aporta el gap → sin esto el margin por defecto de ion-card lo duplica */
    ion-card.rcard.selected { outline: 2px solid var(--primary); outline-offset: -2px; }
    /* #74 — Tarjeta clicable (opt-in row-clickable): la mitad de #67 que faltaba. La vista de
       tarjetas es la que la tabla elige SOLA en móvil, así que sin esto el registro no se podía
       abrir desde un teléfono (medido con combos 0.1.4: 0 rowClick a 390px). */
    ion-card.rcard.clickable { cursor: pointer; }
    ion-card.rcard.clickable:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
    @media (prefers-reduced-motion: reduce) {
      .gh.sortable:hover, .gh.sortable:active,
      .grow-data:hover, .grow-data:active { transform: none; }
    }
    /* Header: ion-card-header as a single row (icon + title + checkbox), keeping Ionic's padding.
       #79 — flex-direction/flex-wrap are SPELLED OUT on purpose: in ios mode (the mode the Hub
       shell pins, ADR-0143) Ionic's own host CSS gives ion-card-header a column direction, so a
       rule that only sets display:flex inherits it and the three children stack on three lines.
       Under md the same rule looked right, which is why it shipped. */
    ion-card-header.rcard-head { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 0.5rem; }
    .rcard-head .rc-icon { display: inline-flex; color: var(--primary); }
    .rcard-head .rc-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    /* Cuerpo: ion-card-content (padding Ionic por defecto) con las filas clave-valor apiladas. */
    ion-card-content.rcard-body { display: flex; flex-direction: column; gap: 0.4rem; }
    .rrow { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 13px; }
    .rrow .rk { color: var(--color-muted); }
    .rrow .rv { font-weight: 500; text-align: right; color: var(--color); }
    /* Barra de acciones (Ionic no trae "card actions"): pie alineado a la derecha, fondo transparente. */
    .ractions { display: flex; justify-content: flex-end; gap: 0.25rem; padding: 0 0.5rem 0.5rem; }

    /* ── Estado vacío ────────────────────────────────────────────────────────────────────── */
    .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 3.5rem 1rem; text-align: center; color: var(--color-muted); }
    .empty .empty-ic { display: grid; place-items: center; width: 3.25rem; height: 3.25rem; border-radius: 999px; background: var(--header-background); font-size: 26px; }

    .actions { display: flex; gap: 0.25rem; justify-content: flex-end; }
    /* Las acciones de fila son icon-only y de tamaño small en escritorio. En tablet/móvil se
     * amplía el host completo (no solo el icono) para que el área táctil alcance 44×44 px. */
    @media (pointer: coarse), (max-width: 834px) {
      .actions ion-button { min-width: 44px; min-height: 44px; margin: 0; }
      .toolbtn { width: 44px; height: 44px; }
      .pager .nav ion-button { min-width: 44px; min-height: 44px; margin: 0; }
    }
    /* Spinner de acción en curso (loading): contenido dentro del ion-button small (Ionic lo fija
     * a 28px en el :host, por eso width/height y no font-size). Cubre tabla y tarjetas: los
     * botones de fila siempre van dentro de .actions. */
    .actions ion-spinner { width: 18px; height: 18px; }

    /* ── Pie: contador + paginación ──────────────────────────────────────────────────────── */
    .pager { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.55rem 1rem; border-top: 1px solid var(--border-color); background: var(--header-background); font-size: 12.5px; color: var(--color-muted); }
    .pager .left { display: flex; align-items: center; gap: 0.6rem; }
    .pager .strong { font-weight: 600; color: var(--color); }
    .psize { font: inherit; font-size: 12.5px; padding: 0.2rem 0.35rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--background); color: var(--color); }
    .pager .nav { display: flex; align-items: center; gap: 0.2rem; }
    /* #78 — Pie en MÓVIL: un solo control «Cargar más» en lugar del pager numerado (Shopify
       IndexTable, Fresha, Square y Material hacen lo mismo: nadie pinta botones de página en un
       teléfono). Sin atributo fill: el sólido por defecto de Ionic es el único que pinta caja en
       modo ios (outfitkit#82 / ADR-0143). Los 44px son el área táctil mínima. */
    .pager .load-more { min-height: 44px; margin: 0; --padding-start: 1rem; --padding-end: 1rem; font-size: 13px; }
    .pager .nav .pp { font-weight: 600; color: var(--color); padding: 0 0.25rem; }
    /* Pager numerado: botón por página + «…» en los saltos (look del Hub). */
    /* #92 — min-width/height at 44px so a numbered page button matches the prev/next ion-button's
       own 44px tap target (line above): before this they were visibly smaller than their neighbors. */
    .pnum { min-width: var(--ok-tap-min, 44px); height: var(--ok-tap-min, 44px); padding: 0 0.4rem; border: 1px solid transparent; border-radius: 8px; background: none; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--color); cursor: pointer; transition: background 0.12s, border-color 0.12s; }
    .pnum:hover { background: var(--row-hover); }
    .pnum.on { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, transparent); }
    .pgap { padding: 0 0.15rem; color: var(--color-muted); }
    ion-button { --box-shadow: none; }
  `;
  }
  static {
    this.MOBILE_BREAKPOINT = 640;
  }
  connectedCallback() {
    super.connectedCallback();
    if (typeof window !== "undefined") {
      window.addEventListener("erplora:locale-changed", this.onLocaleChanged);
      window.addEventListener("resize", this.onWindowResize);
    }
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      this.mq = window.matchMedia(`(max-width: ${_OkDataTable2.MOBILE_BREAKPOINT}px)`);
      this.isMobile = this.mq.matches;
      const handler = (e5) => {
        const matches = "matches" in e5 ? e5.matches : this.mq?.matches ?? false;
        if (this.isMobile === matches) return;
        this.isMobile = matches;
        if (matches && this.cardViewEnabled) this.viewMode = "cards";
        else if (!matches && this.viewMode === "cards") this.viewMode = "table";
      };
      this.mq.addEventListener("change", handler);
      this._mqHandler = handler;
    }
  }
  /** #67 — Recalcula si la vista lista desborda a lo ancho (`scrollWidth > clientWidth`).
   *
   * Se mide después de renderizar, que es cuando el navegador ya conoce los anchos, y solo se
   * escribe el estado si CAMBIA: asignarlo siempre reprogramaría un render en bucle. */
  measureXOverflow() {
    const scroll = this.renderRoot?.querySelector?.(".scroll");
    const overflow = !!scroll && scroll.scrollWidth > scroll.clientWidth;
    if (this.xOverflow !== overflow) this.xOverflow = overflow;
  }
  /** Engancha el observador al contenedor de scroll del render actual (cambia entre vistas). */
  observeXOverflow() {
    if (typeof ResizeObserver === "undefined") return;
    const scroll = this.renderRoot?.querySelector?.(".scroll");
    if (!scroll) return;
    this.xObserver ??= new ResizeObserver(() => this.measureXOverflow());
    this.xObserver.disconnect();
    this.xObserver.observe(scroll);
    const grid = scroll.querySelector(".grid");
    if (grid) this.xObserver.observe(grid);
  }
  updated(changed) {
    this.observeXOverflow();
    this.measureXOverflow();
    if (changed.has("panel")) this.syncSheetTop();
  }
  /** #75 — Where the mobile sheet starts. `position: fixed; inset: 0` painted it from y=0 and the
   *  app's `ion-header` (its own stacking context, above the content) covered the sheet's title and
   *  its only Close button — measured at 390×844 in the Appointments parity page. CSS inside a
   *  shadow root cannot know where the content area begins, so on open the table measures the
   *  closest `ion-content` (walking through shadow hosts) and hands the offset over as a custom
   *  property; on close it is removed. Without an `ion-content` around, the sheet keeps y=0. */
  syncSheetTop() {
    if (this.panel === "none") {
      this.style.removeProperty("--ok-sheet-top");
      return;
    }
    let node = this;
    let content = null;
    while (node && !content) {
      const parent = node.parentNode ?? node.getRootNode?.()?.host ?? null;
      if (parent && parent.nodeType === Node.ELEMENT_NODE && parent.tagName === "ION-CONTENT") content = parent;
      node = parent === node ? null : parent;
    }
    const top = content ? Math.max(0, Math.round(content.getBoundingClientRect().top)) : 0;
    this.style.setProperty("--ok-sheet-top", `${top}px`);
  }
  disconnectedCallback() {
    if (typeof window !== "undefined") {
      window.removeEventListener("erplora:locale-changed", this.onLocaleChanged);
      window.removeEventListener("resize", this.onWindowResize);
    }
    this.xObserver?.disconnect();
    this.xObserver = void 0;
    if (this.mq) {
      const handler = this._mqHandler;
      if (handler) this.mq.removeEventListener("change", handler);
      this.mq = void 0;
    }
    super.disconnectedCallback();
  }
  // ── i18n: idioma del documento ← overrides explícitos de `.labels` ─────────────────────────
  get t() {
    const lang = typeof document === "undefined" ? "en" : document.documentElement.lang.toLowerCase();
    return { ...lang.startsWith("es") ? ES_LABELS : DEFAULT_LABELS2, ...this.labels };
  }
  /** Placeholder efectivo del buscador (prop explícita → label i18n → default inglés). */
  get effSearchPlaceholder() {
    return this.searchPlaceholder ?? this.t.search;
  }
  /** Mensaje efectivo de estado vacío (prop explícita → label i18n → default inglés). */
  get effEmptyMessage() {
    return this.emptyMessage ?? this.t.empty;
  }
  // ── Resolución de alias (compat + documentados) ──────────────────────────────────────────
  get effPageSizes() {
    return this.pageSizes ?? this.pageSizeOptions;
  }
  get effColumnPicker() {
    return this.columnPicker || this.columnSelector;
  }
  get effExport() {
    return this.csv || this.exportable;
  }
  get effImport() {
    return this.csv || this.importable;
  }
  /** ¿Está habilitado el conmutador de vista lista/tarjetas? */
  get viewToggle() {
    if (Array.isArray(this.views)) return this.views.length > 1;
    return this.views === true;
  }
  /** ¿Está disponible la vista tarjetas? (presente en `views` o `views === true`). */
  get cardViewEnabled() {
    if (Array.isArray(this.views)) return this.views.some((v3) => v3 === "cards" || v3 === "card");
    return this.views === true;
  }
  /** Columnas actualmente visibles (respeta el column chooser). */
  get visibleColumns() {
    return this.hiddenKeys.size ? this.columns.filter((c5) => !this.hiddenKeys.has(c5.key)) : this.columns;
  }
  setVisibleColumns(keys) {
    const visible = new Set(keys);
    this.hiddenKeys = new Set(this.columns.map((c5) => c5.key).filter((k2) => !visible.has(k2)));
    this.emit("columnsChange", { visible: keys });
  }
  // ── Selección ─────────────────────────────────────────────────────────────────────────────
  keyOf(row) {
    if (typeof this.rowKey === "function") return String(this.rowKey(row) ?? "");
    if (typeof this.rowKey === "string") return String(row[this.rowKey] ?? "");
    return String(row[this.rowKeyField] ?? "");
  }
  get selection() {
    return this.selectedKeys ?? this.internalSelection;
  }
  setSelection(next) {
    if (!this.selectedKeys) this.internalSelection = next;
    this.emit("selectionChange", { keys: [...next] });
    this.requestUpdate();
  }
  toggleRow(key) {
    const next = new Set(this.selection);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.setSelection(next);
  }
  toggleAll(visible) {
    const keys = visible.map((r6) => this.keyOf(r6));
    const allOn = keys.length > 0 && keys.every((k2) => this.selection.has(k2));
    const next = new Set(this.selection);
    if (allOn) keys.forEach((k2) => next.delete(k2));
    else keys.forEach((k2) => next.add(k2));
    this.setSelection(next);
  }
  // ── CSV ─────────────────────────────────────────────────────────────────────────────────────
  csvEscape(v3) {
    const s5 = v3 === null || v3 === void 0 ? "" : String(v3);
    return /[",\n\r]/.test(s5) ? `"${s5.replace(/"/g, '""')}"` : s5;
  }
  /** Exporta las filas a CSV (cabeceras = column.key). Si no hay filas, exporta solo la estructura. */
  exportCsv() {
    const cols = this.columns;
    const head = cols.map((c5) => this.csvEscape(c5.key)).join(",");
    const lines = this.rows.map((r6) => cols.map((c5) => this.csvEscape(r6[c5.key])).join(","));
    const csv = [head, ...lines].join("\r\n");
    const blob = new Blob([CSV_BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a3 = document.createElement("a");
    a3.href = url;
    a3.download = this.csvName;
    a3.click();
    URL.revokeObjectURL(url);
    this.emit("csvExport", { rows: this.rows.length });
    this.emit("export", { rows: this.rows.length });
  }
  parseCsv(text) {
    const out = [];
    let row = [];
    let field = "";
    let q = false;
    for (let i7 = 0; i7 < text.length; i7++) {
      const c5 = text[i7];
      if (q) {
        if (c5 === '"') {
          if (text[i7 + 1] === '"') {
            field += '"';
            i7++;
          } else q = false;
        } else field += c5;
      } else if (c5 === '"') q = true;
      else if (c5 === ",") {
        row.push(field);
        field = "";
      } else if (c5 === "\n" || c5 === "\r") {
        if (c5 === "\r" && text[i7 + 1] === "\n") i7++;
        row.push(field);
        field = "";
        if (row.length > 1 || row[0] !== "") out.push(row);
        row = [];
      } else field += c5;
    }
    if (field !== "" || row.length) {
      row.push(field);
      out.push(row);
    }
    const headers = out.shift() ?? [];
    const rows2 = out.map((r6) => Object.fromEntries(headers.map((h4, i7) => [h4, r6[i7] ?? ""])));
    return { headers, rows: rows2 };
  }
  async onImportFile(ev) {
    const input = ev.target;
    const file = input.files?.[0];
    if (!file) return;
    const text = decodeCsvBuffer(await file.arrayBuffer());
    const { headers, rows: rows2 } = this.parseCsv(text);
    this.emit("csvImport", { headers, rows: rows2 });
    this.emit("import", { headers, rows: rows2 });
    input.value = "";
  }
  toggle(p4) {
    if (p4 === "filters" && this.panel !== "filters") {
      this.filterDraft = this.cloneFilters(this.clientFilters);
    }
    this.panel = this.panel === p4 ? "none" : p4;
  }
  // ── Filtros en memoria (modo cliente): borrador → aplicar. ───────────────────────────────────
  cloneFilters(src) {
    const out = {};
    for (const [k2, f3] of Object.entries(src)) {
      out[k2] = { values: f3.values ? new Set(f3.values) : void 0, from: f3.from, to: f3.to };
    }
    return out;
  }
  // Fija el conjunto de valores seleccionados de una columna (multi-select del drawer = ion-select).
  setFilterValues(key, values) {
    const next = this.cloneFilters(this.filterDraft);
    const clean = (values ?? []).filter((v3) => v3 != null && v3 !== "");
    if (clean.length) next[key] = { ...next[key], values: new Set(clean) };
    else next[key] = { ...next[key], values: void 0 };
    this.filterDraft = next;
  }
  setFilterRange(key, edge, value) {
    const next = this.cloneFilters(this.filterDraft);
    next[key] = { ...next[key], [edge]: value };
    this.filterDraft = next;
  }
  applyFilters() {
    const clean = {};
    for (const [k2, f3] of Object.entries(this.filterDraft)) {
      if (f3.values && f3.values.size > 0 || f3.from || f3.to) clean[k2] = f3;
    }
    this.clientFilters = clean;
    this.clientPage = 0;
    this.mobileShown = 0;
    this.panel = "none";
    this.emit("filterChange", { filters: this.serializeFilters(clean) });
  }
  clearFilters() {
    this.filterDraft = {};
  }
  serializeFilters(src) {
    const out = {};
    for (const [k2, f3] of Object.entries(src)) {
      if (f3.values && f3.values.size > 0) out[k2] = [...f3.values];
      else if (f3.from || f3.to) out[k2] = { from: f3.from ?? "", to: f3.to ?? "" };
    }
    return out;
  }
  /** Abre el panel lateral (API pública para el módulo, p.ej. "editar" abre el form pre-rellenado). */
  open(panel = "create") {
    this.panel = panel;
  }
  /** Cierra el panel lateral. */
  close() {
    this.panel = "none";
  }
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
  get hasSearch() {
    return this.searchable || this.searchKeys.length > 0;
  }
  /** Columnas filtrables (con control en el panel de filtros). En cliente y en servidor. */
  get filterColumns() {
    return this.columns.filter((c5) => c5.filterable);
  }
  /** ¿Hay que mostrar el botón de Filtros? (cualquier columna filtrable). */
  get hasFilterRow() {
    return this.filterColumns.length > 0;
  }
  /** Nº de filtros activos → badge del botón Filtros. En servidor cuenta `filterValues` (#106): sin
   *  esto el embudo no daba NINGUNA señal de que la lista venía acotada. */
  get activeFilterCount() {
    if (this.serverSide) {
      return Object.keys(this.serverFilters).filter((k2) => this.serverFilterState(k2) !== void 0).length;
    }
    return Object.values(this.clientFilters).filter(
      (f3) => f3.values && f3.values.size > 0 || f3.from || f3.to
    ).length;
  }
  // ── Estado de filtro VISIBLE (#106) ──────────────────────────────────────────────────────────
  /** Traduce un valor de `filterValues` (la forma que emite `filterChange`) a la forma interna que
   *  usan los `render*Filter`. `undefined` = ese filtro no está puesto. */
  serverFilterState(key) {
    const raw = this.serverFilters[key];
    if (raw === void 0 || raw === null || raw === "") return void 0;
    if (Array.isArray(raw)) {
      const values = raw.filter((v3) => v3 !== null && v3 !== void 0 && v3 !== "").map((v3) => String(v3));
      return values.length ? { values: new Set(values) } : void 0;
    }
    if (typeof raw === "object") {
      const range = raw;
      const from = range.from === null || range.from === void 0 || range.from === "" ? void 0 : String(range.from);
      const to = range.to === null || range.to === void 0 || range.to === "" ? void 0 : String(range.to);
      return from !== void 0 || to !== void 0 ? { from, to } : void 0;
    }
    return { values: /* @__PURE__ */ new Set([String(raw)]) };
  }
  /** Estado de filtro efectivo de una columna: servidor → `filterValues`/espejo; cliente → memoria. */
  filterStateOf(key) {
    return this.serverSide ? this.serverFilterState(key) : this.clientFilters[key];
  }
  /** Fija (o borra) el valor visible de un filtro en el espejo de servidor. */
  setServerFilter(key, value) {
    const next = { ...this.serverFilters };
    const empty = value === void 0 || value === null || value === "" || Array.isArray(value) && value.length === 0;
    if (empty) delete next[key];
    else next[key] = value;
    this.serverFilters = next;
  }
  /** Fija UN extremo de un rango en el espejo. Los dos extremos viajan en eventos SEPARADOS
   *  (`{from}` y luego `{to}`), así que aquí se MEZCLA: reemplazar borraría el otro extremo. */
  setServerRangeEdge(key, edge, value) {
    const prev = this.serverFilters[key];
    const base = prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev } : {};
    base[edge] = value;
    const alive = (v3) => v3 !== void 0 && v3 !== null && v3 !== "";
    this.setServerFilter(key, alive(base.from) || alive(base.to) ? base : void 0);
  }
  /** Valor crudo de una columna para ordenar/filtrar (usa format si lo hay, si no row[key]). */
  rawValue(col, row) {
    if (col.format) return col.format(row);
    return row[col.key];
  }
  /** Valores distintos de una columna (para los chips del filtro multi-select). */
  distinctValues(col) {
    const set = /* @__PURE__ */ new Set();
    for (const row of this.rows) {
      const v3 = this.rawValue(col, row);
      if (v3 != null && v3 !== "") set.add(String(v3));
    }
    return [...set].sort((a3, b3) => a3.localeCompare(b3));
  }
  /** Filas tras buscar + filtrar + ordenar EN MEMORIA (solo modo cliente). */
  get clientFiltered() {
    let result = this.rows;
    const needle = this.q.trim().toLowerCase();
    if (needle && this.searchKeys.length) {
      result = result.filter(
        (r6) => this.searchKeys.some((k2) => String(r6[k2] ?? "").toLowerCase().includes(needle))
      );
    }
    const fkeys = Object.keys(this.clientFilters);
    if (fkeys.length) {
      result = result.filter(
        (row) => fkeys.every((key) => {
          const f3 = this.clientFilters[key];
          const col = this.columns.find((c5) => c5.key === key);
          if (!col) return true;
          if (f3.values && f3.values.size > 0) {
            return f3.values.has(String(this.rawValue(col, row) ?? ""));
          }
          if (f3.from || f3.to) {
            const raw = this.rawValue(col, row);
            const t7 = raw == null ? NaN : new Date(raw).getTime();
            const from = f3.from ? new Date(f3.from).getTime() : -Infinity;
            const to = f3.to ? new Date(f3.to).getTime() + 864e5 - 1 : Infinity;
            return !Number.isNaN(t7) && t7 >= from && t7 <= to;
          }
          return true;
        })
      );
    }
    if (this.clientSort) {
      const col = this.columns.find((c5) => c5.key === this.clientSort);
      if (col) {
        const dir = this.clientSortDir === "asc" ? 1 : -1;
        result = [...result].sort((a3, b3) => {
          const va = this.rawValue(col, a3);
          const vb = this.rawValue(col, b3);
          if (va == null) return 1;
          if (vb == null) return -1;
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
          return 0;
        });
      }
    }
    return result;
  }
  cell(col, row) {
    if (col.format) return col.format(row);
    const v3 = row[col.key];
    return v3 === null || v3 === void 0 ? "" : String(v3);
  }
  /** ¿Es ordenable la columna? Servidor: opt-in (`sortable`). Cliente: por defecto SÍ (como el Hub),
   *  salvo `sortable: false` explícito. */
  isSortable(col) {
    return this.serverSide ? !!col.sortable : col.sortable !== false;
  }
  onHeaderClick(col) {
    if (!this.isSortable(col)) return;
    if (this.serverSide) {
      const dir = this.sort === col.key && this.sortDir === "asc" ? "desc" : "asc";
      this.emit("sortChange", { sort: col.key, dir });
      return;
    }
    this.mobileShown = 0;
    if (this.clientSort === col.key) {
      this.clientSortDir = this.clientSortDir === "asc" ? "desc" : "asc";
    } else {
      this.clientSort = col.key;
      this.clientSortDir = "asc";
    }
  }
  onFilterInput(col, ev) {
    const value = ev.target.value ?? "";
    this.setServerFilter(col.key, value);
    this.emit("filterChange", { col: col.key, value });
  }
  onRangeInput(col, edge, ev) {
    const raw = ev.target.value ?? "";
    const v3 = raw === "" ? "" : Number(raw);
    this.setServerRangeEdge(col.key, edge, v3);
    this.emit("filterChange", { col: col.key, value: { [edge]: v3 } });
  }
  onDateRangeInput(col, edge, ev) {
    const v3 = ev.target.value ?? "";
    this.setServerRangeEdge(col.key, edge, v3);
    this.emit("filterChange", { col: col.key, value: { [edge]: v3 } });
  }
  // ── Filtros EN LÍNEA (toolbar) ────────────────────────────────────────────────────────────
  // En modo cliente escriben directamente `clientFilters` (filtran en memoria); en servidor solo
  // emiten `filterChange`. Reutilizan la misma forma de filtro que el drawer (values / from / to).
  setClientFilter(key, patch) {
    const next = { ...this.clientFilters };
    const merged = { ...next[key], ...patch };
    const empty = (!merged.values || merged.values.size === 0) && !merged.from && !merged.to;
    if (empty) delete next[key];
    else next[key] = merged;
    this.clientFilters = next;
    this.clientPage = 0;
    this.mobileShown = 0;
  }
  // ion-select (select/multiselect) del panel de filtros (renderFilterControl). En servidor emite
  // `filterChange`; en cliente escribe `clientFilters` (multiselect ⇒ filtra por inclusión).
  onFilterSelect(col, value, multi) {
    if (this.serverSide) {
      const next = value ?? (multi ? [] : "");
      this.setServerFilter(col.key, next);
      this.emit("filterChange", { col: col.key, value: next });
      return;
    }
    if (multi) {
      const arr = Array.isArray(value) ? value.map((v3) => String(v3)) : value != null && value !== "" ? [String(value)] : [];
      this.setClientFilter(col.key, { values: arr.length ? new Set(arr) : void 0 });
    } else {
      const v3 = String(value ?? "");
      this.setClientFilter(col.key, { values: v3 ? /* @__PURE__ */ new Set([v3]) : void 0 });
    }
  }
  onInlineRange(col, edge, ev) {
    const v3 = ev.target.value ?? "";
    if (this.serverSide) {
      this.setServerRangeEdge(col.key, edge, v3);
      this.emit("filterChange", { col: col.key, value: { [edge]: v3 } });
      return;
    }
    this.setClientFilter(col.key, { [edge]: v3 || void 0 });
  }
  // Menú overflow: ancla el popover al botón vía el evento de click (compatible con Shadow DOM).
  openMenu(ev) {
    this.menuEv = ev;
    this.menuOpen = true;
  }
  // Aplica la vista inicial declarada (`default-view`) una sola vez, tras el primer render. Es la
  // forma robusta de arrancar en tarjetas sin depender de fijar `viewMode` por referencia (que
  // falla si la tabla monta detrás de un `v-if`/loading y el ref aún es null).
  firstUpdated() {
    this.applyInitialView();
  }
  /** Re-evalúa la vista inicial cada render mientras el usuario no haya elegido a mano.
   *
   * `firstUpdated` NO basta: decide una sola vez, y los consumidores que asignan las props por JS
   * DESPUÉS de insertar el elemento —lo normal en páginas renderizadas por el servidor— llegan
   * tarde. En ese momento `cardViewEnabled` aún era `false`, así que no se conmutaba; y el
   * listener de `matchMedia` solo dispara al CAMBIAR el viewport, cosa que en un móvil no pasa
   * nunca. La tabla se quedaba con scroll lateral para siempre.
   *
   * Medido en Android contra producción el 2026-08-02 con el bundle ya actualizado:
   *   `views` antes de insertar  → tarjetas
   *   `views` después de insertar → tabla   ← lo que hace la página
   */
  willUpdate(changed) {
    this.applyInitialView();
    if (changed.has("filterValues")) this.serverFilters = { ...this.filterValues ?? {} };
    if (!this.serverSide && changed.has("rows") && this.mobileShown !== 0) this.mobileShown = 0;
  }
  applyInitialView() {
    if (this.viewChosenByUser) return;
    if (this.isMobile && this.cardViewEnabled) {
      this.viewMode = "cards";
    } else if (this.defaultView === "cards" && this.cardViewEnabled) {
      this.viewMode = "cards";
    } else if (this.defaultView === "table") {
      this.viewMode = "table";
    }
  }
  setViewMode(mode) {
    this.viewChosenByUser = true;
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.emit("viewChange", mode);
  }
  // Control de filtro de una columna, con componentes Ionic (mismos inputs que el form de alta).
  renderFilterControl(col) {
    if (!col.filterable) return A;
    const type = col.filterType ?? "text";
    const f3 = this.filterStateOf(col.key);
    if (type === "select" || type === "multiselect") {
      const multi = type === "multiselect";
      const opts = col.options ?? this.distinctValues(col).map((v3) => ({ value: v3, label: v3 }));
      const current = this.selectValue(f3, multi);
      return b2`
        <ion-select
          label=${col.header}
          label-placement="stacked"
          fill="outline" mode="md"
          ?multiple=${multi}
          interface="modal"
          .interfaceOptions=${{ cssClass: "ok-overlay" }}
          placeholder=${this.t.select}
          .value=${current}
          @ionChange=${(e5) => this.onFilterSelect(col, e5.detail.value, multi)}
        >
          ${multi ? A : b2`<ion-select-option value="">${this.t.select}</ion-select-option>`}
          ${opts.map((o7) => b2`<ion-select-option value=${o7.value}>${o7.label}</ion-select-option>`)}
        </ion-select>
      `;
    }
    if (type === "range" || type === "daterange") {
      const t7 = type === "daterange" ? "date" : "number";
      const onEdge = type === "daterange" ? this.onDateRangeInput.bind(this) : this.onRangeInput.bind(this);
      return b2`
        <div class="fblock">
          <span class="flabel">${col.header}</span>
          <div class="frange">
            <ion-input type=${t7} fill="outline" mode="md" placeholder=${type === "daterange" ? this.t.from : this.t.gte}
              .value=${f3?.from ?? ""}
              @ionInput=${(e5) => onEdge(col, "from", e5)}></ion-input>
            <ion-input type=${t7} fill="outline" mode="md" placeholder=${type === "daterange" ? this.t.to : this.t.lte}
              .value=${f3?.to ?? ""}
              @ionInput=${(e5) => onEdge(col, "to", e5)}></ion-input>
          </div>
        </div>
      `;
    }
    const inputType = type === "number" ? "number" : type === "date" ? "date" : "text";
    return b2`
      <ion-input
        type=${inputType}
        fill="outline" mode="md"
        label=${col.header}
        label-placement="stacked"
        placeholder=${this.t.filterPlaceholder}
        .value=${this.selectValue(f3, false)}
        @ionInput=${(e5) => this.onFilterInput(col, e5)}
      ></ion-input>
    `;
  }
  /** Valor para un control de un solo valor (`ion-select`/`ion-input`) o multi (`ion-select
   *  multiple`) a partir del estado de filtro interno. '' / [] = sin filtro. */
  selectValue(f3, multi) {
    const values = [...f3?.values ?? /* @__PURE__ */ new Set()];
    if (multi) return values;
    return values.length ? values[0] : "";
  }
  // Controles de filtro COMPACTOS para la toolbar (modo `inlineFilters`). Solo select y rango de
  // fechas (los del screenshot); el resto de tipos siguen disponibles vía el drawer si no se activa
  // `inlineFilters`. Look: «Todos los Estados» (placeholder) / «01/10/25 → 18/10/25».
  renderInlineFilters() {
    const cols = this.filterColumns.filter((c5) => {
      const t7 = c5.filterType ?? "text";
      return t7 === "select" || t7 === "multiselect" || t7 === "date" || t7 === "daterange";
    });
    if (!cols.length) return A;
    return b2`${cols.map((c5) => this.renderInlineFilter(c5))}`;
  }
  renderInlineFilter(col) {
    const type = col.filterType ?? "text";
    const f3 = this.filterStateOf(col.key);
    if (type === "select" || type === "multiselect") {
      const multi = type === "multiselect";
      const opts = col.options ?? this.distinctValues(col).map((v3) => ({ value: v3, label: v3 }));
      const current = this.selectValue(f3, multi);
      return b2`
        <ion-select
          class="tk-filter"
          ?multiple=${multi}
          interface="modal"
          .interfaceOptions=${{ cssClass: "ok-overlay" }}
          aria-label=${col.header}
          placeholder=${col.header}
          .value=${current}
          @ionChange=${(e5) => this.onFilterSelect(col, e5.detail.value, multi)}
        >
          ${multi ? A : b2`<ion-select-option value="">${col.header}</ion-select-option>`}
          ${opts.map((o7) => b2`<ion-select-option value=${o7.value}>${o7.label}</ion-select-option>`)}
        </ion-select>
      `;
    }
    return b2`
      <span class="tk-daterange" role="group" aria-label=${col.header}>
        <ion-icon .icon=${iconCalendarOutline}></ion-icon>
        <ion-input type="date" aria-label=${this.t.fromOf.replace("{label}", col.header)} .value=${f3?.from ?? ""} @ionChange=${(e5) => this.onInlineRange(col, "from", e5)}></ion-input>
        <span class="arr">→</span>
        <ion-input type="date" aria-label=${this.t.toOf.replace("{label}", col.header)} .value=${f3?.to ?? ""} @ionChange=${(e5) => this.onInlineRange(col, "to", e5)}></ion-input>
      </span>
    `;
  }
  // Menú overflow («⋮») con ion-popover anclado por evento (Shadow-DOM-safe).
  renderOverflowMenu() {
    if (!this.menuActions.length) return A;
    return b2`
      <ion-button class="toolbtn" fill="clear" aria-label=${this.t.moreActions} @click=${(e5) => this.openMenu(e5)}>
        <ion-icon slot="icon-only" .icon=${iconEllipsisVertical}></ion-icon>
      </ion-button>
      <ion-popover
        .isOpen=${this.menuOpen}
        .event=${this.menuEv}
        dismiss-on-select="true"
        @didDismiss=${() => this.menuOpen = false}
      >
        <ion-content>
          <ion-list lines="none">
            ${this.menuActions.map(
      (a3) => b2`
                <ion-item button .detail=${false} @click=${() => {
        this.menuOpen = false;
        this.emit("menuAction", { actionId: a3.id });
      }}>
                  ${a3.icon ? b2`<ion-icon slot="start" .icon=${okIcon(a3.icon)} color=${a3.color ?? A}></ion-icon>` : A}
                  <ion-label color=${a3.color ?? A}>${a3.label}</ion-label>
                </ion-item>
              `
    )}
          </ion-list>
        </ion-content>
      </ion-popover>
    `;
  }
  // Botones de acción de una fila (compartido por vista tabla y tarjetas).
  actionButtons(row) {
    if (!this.actions.length) return A;
    return b2`
      <div class="actions">
        ${this.actions.map(
      (a3) => {
        const loading = a3.loading?.(row) === true;
        const disabled = loading || a3.disabled?.(row) === true;
        const label = typeof a3.label === "function" ? a3.label(row) : a3.label;
        return b2`
            <ion-button
              size="small"
              fill="clear"
              color=${a3.color ?? "medium"}
              ?disabled=${disabled}
              aria-disabled=${disabled ? "true" : A}
              aria-label=${label}
              title=${label}
              @click=${() => this.emit("rowAction", { actionId: a3.id, row })}
            >
              ${loading ? b2`<ion-spinner slot="icon-only" name="dots"></ion-spinner>` : a3.icon ? b2`<ion-icon slot="icon-only" .icon=${okIcon(a3.icon)}></ion-icon>` : label}
            </ion-button>
          `;
      }
    )}
      </div>
    `;
  }
  // Botón de barra icon-only (filtros / alta / conmutador de vista). `on` = estado activo.
  // `badge` opcional → contador (p.ej. nº de filtros activos), look del Hub.
  toolButton(icon, on, onClick, label, badge) {
    return b2`
      <ion-button class="toolbtn" size="small" fill=${on ? "solid" : "outline"} title=${label} aria-label=${label} @click=${onClick}>
        <ion-icon slot="icon-only" .icon=${okIcon(icon)}></ion-icon>
        ${badge && badge > 0 ? b2`<span class="badge">${badge}</span>` : A}
      </ion-button>
    `;
  }
  /** Plantilla de columnas del grid de la vista lista: [checkbox] [columnas…] [acciones]. */
  gridTemplate() {
    return [
      this.selectable ? "2.75rem" : null,
      ...this.visibleColumns.map((c5) => c5.width ?? "minmax(8rem,1fr)"),
      this.actions.length ? "auto" : null
    ].filter(Boolean).join(" ");
  }
  /** Lista de páginas a mostrar en el pager numerado (1-based): primera, última, vecinas de la
   *  actual y «…» donde haya saltos. P.ej. en página 1 de 52 → [1,2,3,'…',52]. */
  pageList(cur1, total) {
    if (total <= 7) return Array.from({ length: total }, (_2, i7) => i7 + 1);
    const want = /* @__PURE__ */ new Set([1, total, cur1, cur1 - 1, cur1 + 1]);
    if (cur1 <= 3) [2, 3].forEach((p4) => want.add(p4));
    if (cur1 >= total - 2) [total - 1, total - 2].forEach((p4) => want.add(p4));
    const sorted = [...want].filter((p4) => p4 >= 1 && p4 <= total).sort((a3, b3) => a3 - b3);
    const out = [];
    let prev = 0;
    for (const p4 of sorted) {
      if (p4 - prev > 1) out.push("\u2026");
      out.push(p4);
      prev = p4;
    }
    return out;
  }
  render() {
    const ps = this.serverSide ? this.pageSize : this.clientPageSize || this.pageSize;
    let visible;
    let pages;
    let current;
    let count;
    if (this.serverSide) {
      visible = this.rows;
      count = this.total;
      pages = Math.max(1, Math.ceil(this.total / ps));
      current = Math.min(this.page, pages - 1);
    } else {
      const filtered = this.clientFiltered;
      count = filtered.length;
      pages = Math.max(1, Math.ceil(filtered.length / ps));
      current = Math.min(this.clientPage, pages - 1);
      visible = this.isMobile ? filtered.slice(0, Math.min(this.mobileShown || ps, count)) : filtered.slice(current * ps, current * ps + ps);
    }
    const served = this.serverSide ? (current + 1) * ps : Math.min(this.mobileShown || ps, count);
    const canLoadMore = this.isMobile && served < count;
    const loadMore = () => {
      if (this.serverSide) this.emit("pageChange", current + 1);
      else this.mobileShown = Math.min((this.mobileShown || ps) + ps, count);
    };
    const goTo = (p4) => {
      if (this.serverSide) this.emit("pageChange", p4);
      else this.clientPage = p4;
    };
    const setPageSize = (n6) => {
      if (this.serverSide) this.emit("pageSizeChange", n6);
      else {
        this.clientPageSize = n6;
        this.clientPage = 0;
        this.mobileShown = 0;
      }
    };
    const searchbar = this.serverSide ? b2`<ion-searchbar class="ion-no-border" placeholder=${this.effSearchPlaceholder} debounce="250" @ionInput=${this.onSearch}></ion-searchbar>` : b2`<ion-searchbar class="ion-no-border" .value=${this.q} placeholder=${this.effSearchPlaceholder} debounce="250" @ionInput=${this.onSearch}></ion-searchbar>`;
    const selCount = this.selection.size;
    const showTopbar = !!this.title || this.hasSearch || this.viewToggle || this.effColumnPicker || this.effExport || this.effImport || this.hasFilterRow || this.addable || !!this.primaryAction;
    return b2`
      <div class=${`card${this.panel !== "none" ? " has-panel" : ""}`}>
        ${showTopbar ? b2`
              <div class="bar">
                <div class="bar-main">
                  ${this.title ? b2`<div class="title-wrap"><h2 class="title">${this.title}</h2><span class="title-count">${count}</span></div>` : A}
                  ${this.hasSearch ? b2`<div class="search">${searchbar}</div>` : A}
                  ${this.inlineFilters ? this.renderInlineFilters() : A}
                  <span class="tk-spacer"></span>
                    ${this.effColumnPicker && !this.isMobile ? b2`
                          <ion-select
                            class="tk-cols"
                            multiple
                            interface="popover"
                            aria-label=${this.t.columnsVisible}
                            .value=${this.visibleColumns.map((c5) => c5.key)}
                            .selectedText=${this.t.columns}
                            @ionChange=${(e5) => this.setVisibleColumns(e5.detail.value)}
                          >
                            ${this.columns.map((c5) => b2`<ion-select-option value=${c5.key}>${c5.header}</ion-select-option>`)}
                          </ion-select>
                        ` : A}
                    ${this.effPageSizes.length && !this.isMobile ? b2`
                          <ion-select
                            class="tk-psize"
                            interface="popover"
                            aria-label=${this.t.rowsPerPage}
                            .value=${ps}
                            @ionChange=${(e5) => setPageSize(Number(e5.detail.value))}
                          >
                            ${this.effPageSizes.map((n6) => b2`<ion-select-option .value=${n6}>${n6}</ion-select-option>`)}
                          </ion-select>
                        ` : A}
                    ${this.viewToggle ? b2`
                          <span class="viewseg">
                            ${this.toolButton("list-outline", this.viewMode === "table", () => this.setViewMode("table"), this.t.viewList)}
                            ${this.toolButton("grid-outline", this.viewMode === "cards", () => this.setViewMode("cards"), this.t.viewCards)}
                          </span>
                        ` : A}
                    ${this.hasFilterRow && !this.inlineFilters ? this.toolButton("funnel-outline", this.panel === "filters" || this.activeFilterCount > 0, () => this.toggle("filters"), this.t.filters, this.activeFilterCount) : A}
                    ${this.effImport ? b2`
                          ${this.toolButton("cloud-upload-outline", false, () => this.renderRoot.querySelector(".tk-file")?.click(), this.t.importCsv)}
                          <input class="tk-file" type="file" accept=".csv,text/csv" hidden @change=${(e5) => this.onImportFile(e5)} />
                        ` : A}
                    ${this.effExport ? this.toolButton("download-outline", false, () => this.exportCsv(), this.t.exportCsv) : A}
                    ${this.addable ? this.isMobile ? b2`
                            <ion-button class="primary-btn add-btn" size="small" @click=${() => this.toggle("create")}>
                              <ion-icon slot="start" .icon=${okIcon("add")}></ion-icon>${this.t.add}
                            </ion-button>
                          ` : this.toolButton("add", this.panel === "create", () => this.toggle("create"), this.t.add) : A}
                    ${this.renderOverflowMenu()}
                    ${this.primaryAction ? this.isMobile ? b2`
                            <ion-button class="primary-btn add-btn" size="small" @click=${() => this.emit("primaryAction", {})}>
                              <ion-icon slot="start" .icon=${okIcon(this.primaryAction.icon ?? "add")}></ion-icon>${this.primaryAction.label}
                            </ion-button>
                          ` : b2`
                          <ion-button
                            class="primary-btn"
                            size="small"
                            title=${this.primaryAction.label}
                            aria-label=${this.primaryAction.label}
                            @click=${() => this.emit("primaryAction", {})}
                          ><ion-icon slot="icon-only" .icon=${okIcon(this.primaryAction.icon ?? "add")}></ion-icon></ion-button>
                        ` : A}
                    <!-- El módulo proyecta aquí acciones globales adicionales. -->
                    <slot name="toolbar"></slot>
                </div>
                ${this.selectable && selCount > 0 ? b2`
                      <div class="selbar">
                        <strong>${this.t.selected.replace("{n}", String(selCount))}</strong>
                        <button class="sel-clear" @click=${() => this.setSelection(/* @__PURE__ */ new Set())}>
                          <ion-icon .icon=${iconClose} style="font-size:14px"></ion-icon> ${this.t.clear}
                        </button>
                      </div>
                    ` : A}
              </div>
            ` : A}

        ${this.viewMode === "cards" && this.cardViewEnabled ? this.renderCards(visible) : this.renderTable(visible)}

        ${pages > 1 || this.effPageSizes.length ? b2`
              <div class="pager">
                <div class="left">
                  <span>
                    ${pages > 1 ? b2`${this.t.showing.replace("{from}", String(this.isMobile && !this.serverSide ? 1 : current * ps + 1)).replace("{to}", String(Math.min(served, count)))} ` : A}
                    <span class="strong">${count}</span> ${count === 1 ? this.t.recordSingular : this.t.recordPlural}
                  </span>
                  ${!showTopbar && this.effPageSizes.length ? b2`
                        <select class="psize" @change=${(e5) => setPageSize(Number(e5.target.value))}>
                          ${this.effPageSizes.map((n6) => b2`<option value=${n6} ?selected=${n6 === ps}>${this.t.perPageShort.replace("{n}", String(n6))}</option>`)}
                        </select>
                      ` : A}
                </div>
                ${this.isMobile ? canLoadMore ? b2`<ion-button class="load-more" size="small" @click=${loadMore}>${this.t.loadMore}</ion-button>` : A : pages > 1 ? b2`
                      <div class="nav">
                        <ion-button size="small" fill="clear" ?disabled=${current === 0} @click=${() => goTo(current - 1)}><ion-icon slot="icon-only" .icon=${iconChevronBack}></ion-icon></ion-button>
                        ${this.pageList(current + 1, pages).map(
      (p4) => p4 === "\u2026" ? b2`<span class="pgap">…</span>` : b2`<button class=${`pnum${p4 === current + 1 ? " on" : ""}`} @click=${() => goTo(p4 - 1)}>${p4}</button>`
    )}
                        <ion-button size="small" fill="clear" ?disabled=${current >= pages - 1} @click=${() => goTo(current + 1)}><ion-icon slot="icon-only" .icon=${iconChevronForward}></ion-icon></ion-button>
                      </div>
                    ` : A}
              </div>
            ` : A}

        ${this.panel !== "none" ? this.renderDrawer() : A}
      </div>
    `;
  }
  // Panel lateral derecho DENTRO de la tabla (no empuja contenido; igual en lista y tarjetas).
  renderDrawer() {
    const isFilters = this.panel === "filters";
    const clientFilters = isFilters && !this.serverSide;
    return b2`
      <div class="tk-scrim" @click=${() => this.close()}></div>
      <aside class="drawer" role="dialog" aria-label=${isFilters ? this.t.filters : this.t.form}>
        <header class="dh">
          <strong>${isFilters ? this.t.filters : this.t.newRecord}</strong>
          <ion-button fill="clear" size="small" aria-label=${this.t.close} @click=${() => this.close()}><ion-icon slot="icon-only" .icon=${iconClose}></ion-icon></ion-button>
        </header>
        <div class="db">
          ${isFilters ? clientFilters ? this.filterColumns.map((c5) => this.renderClientFilter(c5)) : this.filterColumns.map((c5) => b2`<div class="fblock">${this.renderFilterControl(c5)}</div>`) : b2`<slot name="create"></slot>`}
        </div>
        ${clientFilters ? b2`
              <footer class="df">
                <button class="sel-clear df-clear" ?disabled=${Object.keys(this.filterDraft).length === 0} @click=${() => this.clearFilters()}>${this.t.clear}</button>
                <ion-button class="primary-btn" size="small" @click=${() => this.applyFilters()}>${this.t.apply}</ion-button>
              </footer>
            ` : A}
      </aside>
    `;
  }
  // Control de filtro CLIENTE de una columna: chips multi-select (select) o rango de fechas.
  renderClientFilter(col) {
    const label = col.header;
    if (col.filterType === "daterange" || col.filterType === "date") {
      const f3 = this.filterDraft[col.key] ?? {};
      return b2`
        <div class="fblock">
          <span class="flabel">${label}</span>
          <div class="daterange">
            <ion-input type="date" label=${this.t.from} label-placement="stacked" fill="outline" mode="md" .value=${f3.from ?? ""} @ionChange=${(e5) => this.setFilterRange(col.key, "from", e5.detail.value ?? "")}></ion-input>
            <ion-input type="date" label=${this.t.to} label-placement="stacked" fill="outline" mode="md" .value=${f3.to ?? ""} @ionChange=${(e5) => this.setFilterRange(col.key, "to", e5.detail.value ?? "")}></ion-input>
          </div>
        </div>
      `;
    }
    const opts = col.options ?? this.distinctValues(col).map((v3) => ({ value: v3, label: v3 }));
    const selected = [...this.filterDraft[col.key]?.values ?? /* @__PURE__ */ new Set()];
    return b2`
      <div class="fblock">
        <ion-select
          label=${label}
          label-placement="stacked"
          fill="outline" mode="md"
          multiple
          interface="modal"
          .interfaceOptions=${{ cssClass: "ok-overlay" }}
          placeholder=${this.t.select}
          .value=${selected}
          @ionChange=${(e5) => this.setFilterValues(col.key, e5.detail.value ?? [])}
        >
          ${opts.length === 0 ? b2`<ion-select-option .disabled=${true} value="">${this.t.noValues}</ion-select-option>` : opts.map((o7) => b2`<ion-select-option value=${o7.value}>${o7.label}</ion-select-option>`)}
        </ion-select>
      </div>
    `;
  }
  /** #67 — Enter/Espacio activan la fila clicable (y, desde #74, la tarjeta): si se llega con el
   *  tabulador, el ratón no puede ser el único camino. Espacio además NO debe desplazar la página. */
  onRowKeydown(e5, row) {
    if (e5.key !== "Enter" && e5.key !== " " && e5.key !== "Spacebar") return;
    e5.preventDefault();
    this.emit("rowClick", { row });
  }
  emptyState() {
    return b2`
      <div class="empty">
        <span class="empty-ic"><ion-icon .icon=${iconFileTrayOutline}></ion-icon></span>
        <span>${this.effEmptyMessage}</span>
      </div>
    `;
  }
  // Vista LISTA en CSS GRID (no <table>): permite ancho por columna y cabecera sticky.
  renderTable(visible) {
    if (visible.length === 0) return this.emptyState();
    const cols = this.visibleColumns;
    const tpl = { gridTemplateColumns: this.gridTemplate() };
    const allOn = this.selectable && visible.length > 0 && visible.every((r6) => this.selection.has(this.keyOf(r6)));
    const alignCls = (a3) => a3 === "right" ? "right" : a3 === "center" ? "center" : "left";
    return b2`
      <div class=${`scroll${this.xOverflow ? " x-overflow" : ""}`}>
        <div class="grid" role="table">
          <!-- Cabecera -->
          <div class="grow ghead" role="row" style=${o6(tpl)}>
            ${this.selectable ? b2`<span class="selcb"><ion-checkbox .checked=${allOn} aria-label=${this.t.selectAll} @ionChange=${() => this.toggleAll(visible)}></ion-checkbox></span>` : A}
            ${cols.map((c5) => {
      const sortable = this.isSortable(c5);
      const active = sortable && (this.serverSide ? this.sort === c5.key : this.clientSort === c5.key);
      const dir = this.serverSide ? this.sortDir : this.clientSortDir;
      const caretIcon = !active ? iconSwapVerticalOutline : dir === "asc" ? iconChevronUpOutline : iconChevronDownOutline;
      return b2`
                <div
                  class=${`gcell gh ${alignCls(c5.align)}${sortable ? " sortable" : ""}${c5.pinned === "end" ? " actions-col" : ""}`}
                  role="columnheader"
                  @click=${() => this.onHeaderClick(c5)}
                >
                  <span>${c5.header}</span>
                  ${sortable ? b2`<span class=${`caret${active ? " on" : ""}`}><ion-icon .icon=${okIcon(caretIcon)}></ion-icon></span>` : A}
                </div>
              `;
    })}
            ${this.actions.length ? b2`<div class="gcell gh right actions-col" role="columnheader">${this.t.actions}</div>` : A}
          </div>

          <!-- Filas -->
          ${c4(
      visible,
      (row) => this.keyOf(row),
      (row) => {
        const key = this.keyOf(row);
        const selected = this.selectable && this.selection.has(key);
        return b2`
                <div
                  class=${`grow grow-data${selected ? " selected" : ""}${this.rowClickable ? " clickable" : ""}`}
                  role="row"
                  style=${o6(tpl)}
                  tabindex=${this.rowClickable ? "0" : A}
                  @click=${this.rowClickable ? () => this.emit("rowClick", { row }) : A}
                  @keydown=${this.rowClickable ? (e5) => this.onRowKeydown(e5, row) : A}
                >
                  ${this.selectable ? b2`<span class="selcb" @click=${(e5) => e5.stopPropagation()}><ion-checkbox .checked=${selected} aria-label=${this.t.selectRow} @ionChange=${() => this.toggleRow(key)}></ion-checkbox></span>` : A}
                  ${cols.map(
          (c5) => b2`<div class=${`gcell ${alignCls(c5.align)}${c5.pinned === "end" ? " actions-col" : ""}`} role="cell">${c5.render ? c5.render(row) : b2`<span>${this.cell(c5, row)}</span>`}</div>`
        )}
                  ${this.actions.length ? b2`<div class="gcell right actions-col" role="cell" @click=${(e5) => e5.stopPropagation()}>${this.actionButtons(row)}</div>` : A}
                </div>
              `;
      }
    )}
        </div>
      </div>
    `;
  }
  renderCards(visible) {
    if (visible.length === 0) return this.emptyState();
    const hasHead = !!this.cardTitle || !!this.cardIcon || this.selectable;
    return b2`
      <div class="cards-grid">
        ${c4(
      visible,
      (row) => this.keyOf(row),
      (row) => {
        const key = this.keyOf(row);
        const selected = this.selectable && this.selection.has(key);
        const icon = this.cardIcon?.(row);
        return b2`
              <ion-card
                class=${`rcard${selected ? " selected" : ""}${this.rowClickable ? " clickable" : ""}`}
                role=${this.rowClickable ? "button" : A}
                tabindex=${this.rowClickable ? "0" : A}
                @click=${this.rowClickable ? () => this.emit("rowClick", { row }) : A}
                @keydown=${this.rowClickable ? (e5) => this.onRowKeydown(e5, row) : A}
              >
                ${hasHead ? b2`
                      <ion-card-header class="rcard-head">
                        ${icon != null && icon !== "" ? b2`<span class="rc-icon">${typeof icon === "string" ? b2`<ion-icon .icon=${okIcon(icon)}></ion-icon>` : icon}</span>` : A}
                        <span class="rc-title">${this.cardTitle ? this.cardTitle(row) : A}</span>
                        ${this.selectable ? b2`<ion-checkbox .checked=${selected} aria-label=${this.t.select} @click=${(e5) => e5.stopPropagation()} @ionChange=${() => this.toggleRow(key)}></ion-checkbox>` : A}
                      </ion-card-header>
                    ` : A}
                <ion-card-content class="rcard-body">
                  ${this.renderCard ? this.renderCard(row) : this.visibleColumns.map(
          (c5) => b2`<div class="rrow"><span class="rk">${c5.header}</span><span class="rv">${c5.render ? c5.render(row) : this.cell(c5, row)}</span></div>`
        )}
                </ion-card-content>
                ${this.actions.length ? b2`<div class="ractions" @click=${(e5) => e5.stopPropagation()}>${this.actionButtons(row)}</div>` : A}
              </ion-card>
            `;
      }
    )}
      </div>
    `;
  }
};
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "columns");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "rows");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "searchKeys");
__decorateClass4([
  n4({ attribute: "row-key-field" })
], _OkDataTable.prototype, "rowKeyField");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "rowKey");
__decorateClass4([
  n4({ type: Number, attribute: "page-size" })
], _OkDataTable.prototype, "pageSize");
__decorateClass4([
  n4({ attribute: "empty-message" })
], _OkDataTable.prototype, "emptyMessage");
__decorateClass4([
  n4({ attribute: "search-placeholder" })
], _OkDataTable.prototype, "searchPlaceholder");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "labels");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "actions");
__decorateClass4([
  n4({ type: Boolean })
], _OkDataTable.prototype, "addable");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "pageSizeOptions");
__decorateClass4([
  n4({ type: Boolean, reflect: true })
], _OkDataTable.prototype, "fill");
__decorateClass4([
  n4({ type: Boolean, attribute: "column-picker" })
], _OkDataTable.prototype, "columnPicker");
__decorateClass4([
  n4({ type: Boolean })
], _OkDataTable.prototype, "csv");
__decorateClass4([
  n4({ attribute: "csv-name" })
], _OkDataTable.prototype, "csvName");
__decorateClass4([
  n4({ type: Boolean, attribute: "server-side" })
], _OkDataTable.prototype, "serverSide");
__decorateClass4([
  n4({ type: Number })
], _OkDataTable.prototype, "total");
__decorateClass4([
  n4({ type: Number })
], _OkDataTable.prototype, "page");
__decorateClass4([
  n4({ type: Boolean })
], _OkDataTable.prototype, "searchable");
__decorateClass4([
  n4({ type: String })
], _OkDataTable.prototype, "sort");
__decorateClass4([
  n4({ attribute: "sort-dir" })
], _OkDataTable.prototype, "sortDir");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "filterValues");
__decorateClass4([
  n4()
], _OkDataTable.prototype, "title");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "views");
__decorateClass4([
  n4({ attribute: "default-view" })
], _OkDataTable.prototype, "defaultView");
__decorateClass4([
  n4({ type: Boolean })
], _OkDataTable.prototype, "exportable");
__decorateClass4([
  n4({ type: Boolean })
], _OkDataTable.prototype, "importable");
__decorateClass4([
  n4({ type: Boolean, attribute: "column-selector" })
], _OkDataTable.prototype, "columnSelector");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "pageSizes");
__decorateClass4([
  n4({ type: Boolean, attribute: "row-clickable" })
], _OkDataTable.prototype, "rowClickable");
__decorateClass4([
  n4({ type: Boolean })
], _OkDataTable.prototype, "selectable");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "selectedKeys");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "primaryAction");
__decorateClass4([
  n4({ type: Boolean })
], _OkDataTable.prototype, "inlineFilters");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "menuActions");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "cardTitle");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "cardIcon");
__decorateClass4([
  n4({ attribute: false })
], _OkDataTable.prototype, "renderCard");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "q");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "clientPage");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "clientPageSize");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "mobileShown");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "clientSort");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "clientSortDir");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "clientFilters");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "filterDraft");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "serverFilters");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "panel");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "viewMode");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "isMobile");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "xOverflow");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "hiddenKeys");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "internalSelection");
__decorateClass4([
  r5()
], _OkDataTable.prototype, "menuOpen");
var OkDataTable = _OkDataTable;
define("ok-data-table", OkDataTable);

// @erplora/module-sdk/src/index.ts
function isEmpty(v3) {
  return v3 === null || v3 === void 0 || v3 === "";
}
var ListController = class {
  constructor(client, queryName, onChange = () => {
  }, opts = {}) {
    this.client = client;
    this.queryName = queryName;
    this.onChange = onChange;
    this.rows = [];
    this.total = 0;
    this.loading = false;
    this.error = "";
    /** Descarta respuestas obsoletas si llegan fuera de orden (race de cargas concurrentes). */
    this.seq = 0;
    this.state = {
      page: 0,
      pageSize: opts.pageSize ?? 50,
      search: "",
      sort: opts.sort,
      dir: opts.dir ?? "asc",
      filters: { ...opts.filters ?? {} },
      context: { ...opts.context ?? {} }
    };
  }
  /** Nº de páginas según el total del servidor (mínimo 1). */
  get pageCount() {
    return Math.max(1, Math.ceil(this.total / this.state.pageSize));
  }
  /** (Re)carga la página actual desde el servidor. */
  async load() {
    const s5 = this.state;
    const mySeq = ++this.seq;
    this.loading = true;
    this.error = "";
    this.onChange();
    try {
      const page = await this.client.queryPage(this.queryName, {
        limit: s5.pageSize,
        offset: s5.page * s5.pageSize,
        search: s5.search,
        sort: s5.sort,
        dir: s5.dir,
        filters: s5.filters,
        params: s5.context
      });
      if (mySeq !== this.seq) return;
      this.rows = page.rows ?? [];
      this.total = page.total ?? this.rows.length;
    } catch (e5) {
      if (mySeq !== this.seq) return;
      this.rows = [];
      this.total = 0;
      this.error = e5 instanceof Error ? e5.message : "Error cargando datos";
    } finally {
      if (mySeq === this.seq) {
        this.loading = false;
        this.onChange();
      }
    }
  }
  setPage(page) {
    this.state.page = Math.max(0, page);
    void this.load();
  }
  setSort(sort, dir) {
    this.state.sort = sort;
    this.state.dir = dir;
    this.state.page = 0;
    void this.load();
  }
  setSearch(search) {
    this.state.search = search;
    this.state.page = 0;
    void this.load();
  }
  /** Cambia el nº de filas por página y recarga desde la página 0. */
  setPageSize(pageSize) {
    this.state.pageSize = Math.max(1, pageSize);
    this.state.page = 0;
    void this.load();
  }
  /** Aplica/quita un filtro de columna; valores vacíos lo eliminan. Vuelve a la página 0. */
  setFilter(col, value) {
    if (isEmpty(value)) {
      delete this.state.filters[col];
    } else if (typeof value === "object" && value !== null) {
      const prev = this.state.filters[col] ?? {};
      const merged = { ...prev, ...value };
      const cleaned = Object.fromEntries(Object.entries(merged).filter(([, v3]) => !isEmpty(v3)));
      if (Object.keys(cleaned).length === 0) delete this.state.filters[col];
      else this.state.filters[col] = cleaned;
    } else {
      this.state.filters[col] = value;
    }
    this.state.page = 0;
    void this.load();
  }
  /** Fija/actualiza los params de contexto obligatorios (p.ej. al seleccionar el padre).
   *  Vuelve a la página 0 y recarga. Pasa `{}` o keys con valor vacío para limpiar. */
  setContext(context) {
    this.state.context = { ...context };
    this.state.page = 0;
    void this.load();
  }
  reset() {
    this.state.page = 0;
    this.state.search = "";
    this.state.filters = {};
    void this.load();
  }
};
function createListController(client, queryName, onChange = () => {
}, opts = {}) {
  return new ListController(client, queryName, onChange, opts);
}

// ui/components/erp-kitchen-history/erp-kitchen-history.ts
var CATALOG2 = { es: es_default, en: en_default };
function erplora2() {
  const c5 = globalThis.erplora;
  if (!c5) throw new Error("erplora SDK not initialised by the shell");
  return c5;
}
var ACTION_LABEL_KEY = {
  received: "ui.actionReceived",
  started: "ui.actionStarted",
  bumped: "ui.actionBumped",
  item_bumped: "ui.actionItemBumped",
  item_recalled: "ui.actionItemRecalled",
  served: "ui.actionServed",
  recalled: "ui.actionRecalled",
  cancelled: "ui.actionCancelled"
};
function actionLabel(code) {
  const key = ACTION_LABEL_KEY[code];
  return key ? erplora2().t(CATALOG2, key) : code;
}
function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(erplora2().locale === "en" ? "en-GB" : "es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
var ErpKitchenHistory = class extends i3 {
  constructor() {
    super(...arguments);
    this.onLocaleChange = () => this.requestUpdate();
  }
  static {
    this.styles = i`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    header { display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem; }
    h2 { margin:0; font-size:1.15rem; flex:1; }
  `;
  }
  get columns() {
    const t7 = (k2) => erplora2().t(CATALOG2, k2);
    return [
      {
        key: "action",
        header: t7("ui.colAction"),
        sortable: true,
        filterable: true,
        filterType: "select",
        // The same map the cell renders with — one source, not two (kitchen#44).
        options: Object.entries(ACTION_LABEL_KEY).map(([value, labelKey]) => ({ value, label: t7(labelKey) })),
        format: (r6) => actionLabel(String(r6.action ?? ""))
      },
      // kitchen#44: the ticket NUMBER the KDS shows — the whole point of the trail is matching an
      // action with the ticket in front of you, and nobody matches a UUID by eye. The id stays as
      // the fallback of last resort (a row never blanks), and the box filters what it shows.
      {
        key: "order_number",
        header: t7("ui.colOrder"),
        sortable: true,
        filterable: true,
        filterType: "text",
        format: (r6) => String(r6.order_number || r6.order_id || "\u2014")
      },
      { key: "notes", header: t7("ui.colNotes"), sortable: true, filterable: true, filterType: "text" },
      {
        key: "created_at",
        header: t7("ui.colWhen"),
        sortable: true,
        filterable: true,
        filterType: "daterange",
        format: (r6) => formatWhen(String(r6.created_at ?? ""))
      }
    ];
  }
  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener("erplora:locale-changed", this.onLocaleChange);
    this.ctrl = createListController(erplora2(), "kitchen.logs.list", () => this.requestUpdate(), {
      pageSize: 50,
      sort: "created_at",
      dir: "desc"
    });
    await this.ctrl.load();
    try {
      const reload = () => this.ctrl.load();
      const offs = [
        erplora2().on("kitchen.order.created", reload),
        erplora2().on("kitchen.order.received", reload),
        erplora2().on("kitchen.order.fired", reload),
        erplora2().on("kitchen.order.ready", reload),
        erplora2().on("kitchen.order.served", reload),
        erplora2().on("kitchen.order.recalled", reload),
        erplora2().on("kitchen.order.cancelled", reload),
        erplora2().on("kitchen.item.bumped", reload),
        erplora2().on("kitchen.item.recalled", reload)
      ];
      this.unsub = () => offs.forEach((off) => off());
    } catch {
    }
  }
  disconnectedCallback() {
    window.removeEventListener("erplora:locale-changed", this.onLocaleChange);
    super.disconnectedCallback();
    this.unsub?.();
  }
  render() {
    const t7 = (k2) => erplora2().t(CATALOG2, k2);
    return b2`<div>
        <header><h2>${t7("ui.historyTitle")}</h2></header>
        ${this.ctrl?.error ? b2`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.ctrl.error}</ok-inline-feedback>` : A}
        <ok-data-table .serverSide=${true} .columns=${this.columns} .views=${true} .cardTitle=${(r6) => String(r6.order_number || r6.order_id || "\u2014")} .cardIcon=${() => "restaurant-outline"} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? "desc"} .searchable=${true} .searchPlaceholder=${t7("ui.searchLogs")} .emptyMessage=${this.ctrl?.loading ? t7("ui.loading") : t7("ui.emptyLogs")} @pageChange=${(e5) => this.ctrl.setPage(e5.detail)} @sortChange=${(e5) => this.ctrl.setSort(e5.detail.sort, e5.detail.dir)} @searchChange=${(e5) => this.ctrl.setSearch(e5.detail)} @filterChange=${(e5) => this.ctrl.setFilter(e5.detail.col, e5.detail.value)}></ok-data-table>
      </div>`;
  }
};
define("erp-kitchen-history", ErpKitchenHistory);

// ui/lib/enums.ts
var CATALOG3 = { es: es_default, en: en_default };
function erplora3() {
  const c5 = globalThis.erplora;
  if (!c5) throw new Error("erplora SDK no inicializado por el shell");
  return c5;
}
var ORDER_TYPE_KEY = {
  dine_in: "ui.orderType_dine_in",
  takeaway: "ui.orderType_takeaway",
  delivery: "ui.orderType_delivery"
};
var PRIORITY_KEY = {
  normal: "ui.priority_normal",
  rush: "ui.priority_rush",
  vip: "ui.priority_vip"
};
function enumLabel(keys, value) {
  const raw = value == null ? "" : String(value);
  const key = keys[raw];
  return key ? erplora3().t(CATALOG3, key) : raw;
}
function enumOptions(keys) {
  return Object.keys(keys).map((value) => ({ value, label: enumLabel(keys, value) }));
}

// ui/components/erp-kitchen-orders-active/erp-kitchen-orders-active.ts
var CATALOG4 = { es: es_default, en: en_default };
function erplora4() {
  const c5 = globalThis.erplora;
  if (!c5) throw new Error("erplora SDK no inicializado por el shell");
  return c5;
}
function can2(permission) {
  const client = erplora4();
  return typeof client.hasPermission === "function" ? client.hasPermission(permission) : true;
}
var DEFAULT_ORDER_TYPE = "dine_in";
function resolveDefaultOrderType(row) {
  const value = row?.default_order_type;
  const text = typeof value === "string" ? value : "";
  return text in ORDER_TYPE_KEY ? text : DEFAULT_ORDER_TYPE;
}
var VERB_PERMISSION = {
  fire: "kitchen.change_order",
  mark_ready: "kitchen.change_order",
  mark_served: "kitchen.complete_order",
  recall: "kitchen.change_order",
  cancel: "kitchen.cancel_order"
};
var ALLOWED_FROM = {
  fire: ["pending"],
  mark_ready: ["pending", "preparing"],
  mark_served: ["ready"],
  recall: ["ready"],
  cancel: ["pending", "preparing", "ready"]
};
function errorText2(e5, fallbackKey) {
  const code = e5?.code;
  if (typeof code === "string") {
    const lang = CATALOG4[erplora4().locale] ?? CATALOG4.en;
    const text = lang?.errors?.[code] ?? CATALOG4.en.errors?.[code];
    if (text) return text;
  }
  return e5 instanceof Error ? e5.message : erplora4().t(CATALOG4, fallbackKey);
}
var ErpKitchenOrdersActive = class extends i3 {
  constructor() {
    super(...arguments);
    this.formError = "";
    this.newType = DEFAULT_ORDER_TYPE;
    this.newNotes = "";
    this.saving = false;
    this.tick = 0;
    this.onLocaleChange = () => this.requestUpdate();
  }
  static {
    this.styles = i`
    :host { display:block; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    header { display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem; }
    h2 { margin:0; font-size:1.15rem; flex:1; }
    .form { display:flex; gap:.75rem; flex-wrap:wrap; align-items:end; margin:.5rem 0 1rem; }
    .form ion-input, .form ion-select { flex:1 1 11rem; min-width:9rem; }
    .err { color:#d9480f; font-weight:600; }
    .actions { display:flex; gap:.35rem; }
  `;
  }
  // Getters (no campos): se re-evalúan en cada render → los textos cambian con el idioma activo (ADR-0055).
  get columns() {
    const t7 = (k2) => erplora4().t(CATALOG4, k2);
    return [
      { key: "order_number", header: t7("ui.colOrder"), sortable: true, filterable: true, filterType: "text" },
      // ADR-0141: a dónde va el plato. Es una ETIQUETA OPACA que manda quien dispara ("Mesa 4",
      // "Barra", "Recogida Ana"): cocina la imprime tal cual y no depende de `tables`.
      { key: "label", header: t7("ui.colLabel"), width: "140px", sortable: true, filterable: true, filterType: "text" },
      // CLOSED domains (`schemas/order_create.json`): they are PICKED, not typed. A free-text box
      // here obliged the cook to know the internal value, in English (`dine_in`) — and since the
      // manifest filters them by equality, anything else emptied the list without saying why
      // (kitchen#39). `op: eq` is the right operator for a picker, so what changes is the box.
      {
        key: "order_type",
        header: t7("ui.colType"),
        sortable: true,
        filterable: true,
        filterType: "select",
        format: (r6) => enumLabel(ORDER_TYPE_KEY, r6.order_type),
        options: enumOptions(ORDER_TYPE_KEY)
      },
      {
        key: "priority",
        header: t7("ui.colPriority"),
        sortable: true,
        filterable: true,
        filterType: "select",
        format: (r6) => enumLabel(PRIORITY_KEY, r6.priority),
        options: enumOptions(PRIORITY_KEY)
      },
      {
        key: "status",
        header: t7("ui.colStatus"),
        sortable: true,
        filterable: true,
        filterType: "select",
        options: [
          { value: "pending", label: t7("ui.statusPending") },
          { value: "preparing", label: t7("ui.statusPreparing") },
          { value: "ready", label: t7("ui.statusReady") },
          { value: "served", label: t7("ui.statusServed") },
          { value: "cancelled", label: t7("ui.statusCancelled") }
        ]
      },
      {
        key: "total",
        header: t7("ui.colTotal"),
        align: "right",
        sortable: true,
        filterable: true,
        filterType: "range",
        // El total llega en CÉNTIMOS → `formatMoney` (divide). Antes hacía `toFixed(2)` sobre
        // los céntimos crudos y una comanda de 6,00 € se pintaba «600.00» (incidencia 5).
        format: (r6) => erplora4().formatMoney(Number(r6.total || 0))
      }
    ];
  }
  get rowActions() {
    const t7 = (k2) => erplora4().t(CATALOG4, k2);
    const all = [
      // Solo icono (ADR-0133): el `label` viaja como title + aria-label del botón, no como texto.
      { id: "fire", label: t7("ui.rowFire"), icon: "flame-outline" },
      { id: "mark_ready", label: t7("ui.rowMarkReady"), icon: "checkmark-done-outline" },
      { id: "mark_served", label: t7("ui.rowMarkServed"), icon: "restaurant-outline" },
      { id: "recall", label: t7("ui.rowRecall"), icon: "arrow-undo-outline" },
      { id: "cancel", label: t7("ui.rowCancel"), icon: "close-circle-outline", color: "danger" }
    ];
    return all.filter((a3) => can2(VERB_PERMISSION[a3.id])).map((a3) => ({ ...a3, disabled: (row) => !ALLOWED_FROM[a3.id].includes(String(row.status ?? "")) }));
  }
  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener("erplora:locale-changed", this.onLocaleChange);
    await this.loadDefaultOrderType();
    this.ctrl = createListController(erplora4(), "kitchen.orders.list", () => this.requestUpdate(), {
      pageSize: 50,
      sort: "created_at",
      dir: "desc"
    });
    await this.ctrl.load();
    try {
      const offs = [
        erplora4().on("kitchen.order.created", () => this.ctrl.load()),
        erplora4().on("kitchen.order.updated", () => this.ctrl.load()),
        erplora4().on("kitchen.order.fired", () => this.ctrl.load()),
        erplora4().on("kitchen.order.ready", () => this.ctrl.load()),
        erplora4().on("kitchen.order.served", () => this.ctrl.load()),
        erplora4().on("kitchen.order.recalled", () => this.ctrl.load()),
        erplora4().on("kitchen.order.cancelled", () => this.ctrl.load()),
        erplora4().on("kitchen.order.deleted", () => this.ctrl.load())
      ];
      this.unsub = () => offs.forEach((o7) => o7());
    } catch {
    }
  }
  disconnectedCallback() {
    window.removeEventListener("erplora:locale-changed", this.onLocaleChange);
    super.disconnectedCallback();
    this.unsub?.();
  }
  /** Reads the hub's default order type once, when the screen opens. Silent on failure on
   *  purpose: this is the INITIAL value of a picker the user can change, so a hub without the
   *  singleton row (or a role without `kitchen.view_settings`) gets `dine_in` and a working
   *  form — never an error banner over a screen whose real job is the ticket list. */
  async loadDefaultOrderType() {
    try {
      const rows2 = await erplora4().query("kitchen.settings.get");
      const row = Array.isArray(rows2) ? rows2[0] : rows2;
      this.newType = resolveDefaultOrderType(row);
    } catch {
      this.newType = DEFAULT_ORDER_TYPE;
    }
  }
  async createOrder(ev) {
    ev.preventDefault();
    this.saving = true;
    this.formError = "";
    try {
      await erplora4().command("kitchen.orders.create", {
        order_type: this.newType,
        priority: "normal",
        notes: this.newNotes.trim(),
        items: []
      });
      this.newNotes = "";
      await this.ctrl.load();
    } catch (e5) {
      this.formError = e5 instanceof Error ? e5.message : erplora4().t(CATALOG4, "ui.createOrderError");
    } finally {
      this.saving = false;
    }
  }
  async onRowAction(ev) {
    const { actionId, row } = ev.detail;
    this.formError = "";
    try {
      const order_id = row.id;
      switch (actionId) {
        case "mark_served":
          await erplora4().command("kitchen.orders.mark_served", { order_id });
          break;
        case "cancel":
          await erplora4().command("kitchen.orders.cancel", { order_id });
          break;
        default:
          await erplora4().command("kitchen.orders.set_status", { order_id, action_name: actionId });
      }
      await this.ctrl.load();
    } catch (e5) {
      this.formError = errorText2(e5, "ui.updateStatusError");
      await this.ctrl.load().catch(() => void 0);
    }
  }
  render() {
    const t7 = (k2) => erplora4().t(CATALOG4, k2);
    return b2`<div>
        <header>
          <h2>${t7("ui.ordersTitle")}</h2>
        </header>
        <form class="form" @submit=${(e5) => this.createOrder(e5)}>
          <ion-select mode="md" fill="outline" label-placement="floating" label=${t7("ui.colType")} .value=${this.newType} @ionChange=${(e5) => this.newType = e5.target.value}>
            ${enumOptions(ORDER_TYPE_KEY).map(
      (o7) => b2`<ion-select-option value=${o7.value}>${o7.label}</ion-select-option>`
    )}
          </ion-select>
          <ion-input mode="md" fill="outline" label-placement="floating" label=${t7("ui.colNotes")} .value=${this.newNotes} @ionInput=${(e5) => this.newNotes = e5.target.value}></ion-input>
          <ion-button type="submit" size="small" ?disabled=${this.saving}>${this.saving ? t7("ui.creatingOrder") : t7("ui.newOrder")}</ion-button>
        </form>
        ${this.formError ? b2`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.formError}</ok-inline-feedback>` : A}
        ${this.ctrl?.error ? b2`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.ctrl.error}</ok-inline-feedback>` : A}
        <ok-data-table .serverSide=${true} .columns=${this.columns} .views=${true} .cardTitle=${(r6) => String(r6.order_number ?? "\u2014")} .cardIcon=${() => "restaurant-outline"} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? "desc"} .searchable=${true} .searchPlaceholder=${t7("ui.searchOrders")} .emptyMessage=${this.ctrl?.loading ? t7("ui.loading") : t7("ui.emptyOrders")} .actions=${this.rowActions} @rowAction=${(e5) => this.onRowAction(e5)} @pageChange=${(e5) => this.ctrl.setPage(e5.detail)} @sortChange=${(e5) => this.ctrl.setSort(e5.detail.sort, e5.detail.dir)} @searchChange=${(e5) => this.ctrl.setSearch(e5.detail)} @filterChange=${(e5) => this.ctrl.setFilter(e5.detail.col, e5.detail.value)}></ok-data-table>
      </div>`;
  }
};
__decorateClass([
  r5()
], ErpKitchenOrdersActive.prototype, "formError", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersActive.prototype, "newType", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersActive.prototype, "newNotes", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersActive.prototype, "saving", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersActive.prototype, "tick", 2);
define("erp-kitchen-orders-active", ErpKitchenOrdersActive);

// ui/components/erp-kitchen-orders-stations/erp-kitchen-orders-stations.ts
var CATALOG5 = { es: es_default, en: en_default };
function erplora5() {
  const c5 = globalThis.erplora;
  if (!c5) throw new Error("erplora SDK no inicializado por el shell");
  return c5;
}
function stationName(s5) {
  return String(s5.name_es || s5.name || "\u2014");
}
var ErpKitchenOrdersStations = class extends i3 {
  constructor() {
    super(...arguments);
    this.formError = "";
    this.formMsg = "";
    this.newName = "";
    this.newPrinter = "";
    this.saving = false;
    this.tick = 0;
    this.editing = null;
    this.editName = "";
    this.editPrinter = "";
    this.editColor = "";
    this.editActive = true;
    this.routeStationId = "";
    this.routeProductId = "";
    this.routeCategoryId = "";
    this.productOptions = [];
    this.categoryOptions = [];
    this.pendingCounts = /* @__PURE__ */ new Map();
    this.onLocaleChange = () => this.requestUpdate();
  }
  static {
    this.styles = i`
    :host { display:flex; flex-direction:column; height:100%; min-height:0; font-family: system-ui, sans-serif; color: var(--ion-text-color, #1c1b18); }
    /* La vista llena el alto: el data-table ocupa lo que sobra (scroll interno, pie fijo). */
    .page { display:flex; flex-direction:column; min-height:0; flex:1 1 auto; }
    .page > ok-data-table { flex:1 1 auto; min-height:0; }
    h3 { margin:.25rem 0 .5rem; font-size:1rem; }
    /* Los paneles de edición/enrutado siguen fuera de la tabla (no son altas de fila): ahí el form
       es ancho y va en fila. El alta, dentro del panel lateral de la tabla, va en columna. */
    .form { display:flex; gap:.75rem; flex-wrap:wrap; align-items:end; margin:.5rem 0 1rem; }
    .form ion-input, .form ion-select { flex:1 1 11rem; min-width:9rem; }
    .create-form { display:flex; flex-direction:column; gap:.7rem; }
    .create-form ion-button { align-self:flex-end; }
    .panel { border:1px solid var(--ion-border-color,#e7e2d6); border-radius: var(--ok-radius-sm, 10px); padding:.75rem 1rem; margin:0 0 1rem; background:var(--ok-surface-2, var(--ion-color-step-50, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.04))); }
    .err { color:#d9480f; font-weight:600; }
    .ok { color:#2b8a3e; font-weight:600; }
  `;
  }
  // Getters (no campos): se re-evalúan en cada render → los textos cambian con el idioma activo (ADR-0055).
  get columns() {
    const t7 = (k2) => erplora5().t(CATALOG5, k2);
    return [
      // kitchen#45: la columna pinta el nombre EN EL IDIOMA DEL HUB (name_es con caída a name); la
      // query ya proyectaba name_es y nadie lo miraba. El filtro/sort acompañan a lo que se ve.
      { key: "name_es", header: t7("ui.colStation"), sortable: true, filterable: true, filterType: "text", format: (r6) => stationName(r6) },
      {
        key: "printer_name",
        header: t7("ui.colPrinter"),
        sortable: true,
        filterable: true,
        filterType: "text",
        format: (r6) => r6.printer_name || "\u2014"
      },
      { key: "pending_count", header: t7("ui.colInProgress"), align: "right", format: (r6) => String(this.pendingCounts.get(String(r6.id)) ?? 0) },
      {
        key: "is_active",
        header: t7("ui.colActive"),
        sortable: true,
        filterable: true,
        filterType: "select",
        options: [
          { value: "1", label: t7("ui.yes") },
          { value: "0", label: t7("ui.no") }
        ],
        format: (r6) => Number(r6.is_active) ? t7("ui.yes") : t7("ui.no")
      }
    ];
  }
  get rowActions() {
    const t7 = (k2) => erplora5().t(CATALOG5, k2);
    return [
      // Solo icono (ADR-0133): el `label` viaja como title + aria-label del botón, no como texto.
      { id: "edit", label: t7("ui.rowEdit"), icon: "create-outline" },
      { id: "route", label: t7("ui.rowRoute"), icon: "git-branch-outline" },
      { id: "delete", label: t7("ui.rowDelete"), icon: "trash-outline", color: "danger" }
    ];
  }
  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener("erplora:locale-changed", this.onLocaleChange);
    this.ctrl = createListController(erplora5(), "kitchen.stations.list", () => this.requestUpdate(), {
      pageSize: 50,
      sort: "name",
      dir: "asc"
    });
    await Promise.all([this.ctrl.load(), this.loadAux()]);
    try {
      const offs = [
        erplora5().on("kitchen.station.created", () => this.reload()),
        erplora5().on("kitchen.station.updated", () => this.reload()),
        erplora5().on("kitchen.station.deleted", () => this.reload()),
        erplora5().on("kitchen.routing.changed", () => this.reload())
      ];
      this.unsub = () => offs.forEach((o7) => o7());
    } catch {
    }
  }
  disconnectedCallback() {
    window.removeEventListener("erplora:locale-changed", this.onLocaleChange);
    super.disconnectedCallback();
    this.unsub?.();
  }
  async reload() {
    await Promise.all([this.ctrl.load(), this.loadAux()]);
  }
  async loadAux() {
    try {
      const pending = await erplora5().query("kitchen.stations.pending_counts");
      this.pendingCounts = new Map((pending ?? []).map((p4) => [p4.station_id, p4.pending_count]));
      this.requestUpdate();
    } catch {
    }
    try {
      const [products, categories] = await Promise.all([
        erplora5().query("inventory.products.list", { limit: 500 }).catch(() => []),
        erplora5().query("inventory.categories.list", { limit: 500 }).catch(() => [])
      ]);
      this.productOptions = Array.isArray(products) ? products.filter((p4) => p4?.id && p4?.name) : [];
      this.categoryOptions = Array.isArray(categories) ? categories.filter((c5) => c5?.id && c5?.name) : [];
      this.requestUpdate();
    } catch {
    }
  }
  // Referencia al ok-data-table para cerrar su panel lateral (drawer) tras el alta.
  dataTable() {
    return this.renderRoot.querySelector("ok-data-table");
  }
  async createStation(ev) {
    ev.preventDefault();
    if (!this.newName.trim()) return;
    this.saving = true;
    this.formError = "";
    this.formMsg = "";
    try {
      await erplora5().command("kitchen.stations.create", {
        name: this.newName.trim(),
        printer_name: this.newPrinter.trim()
      });
      this.newName = "";
      this.newPrinter = "";
      this.dataTable()?.close();
      await this.reload();
    } catch (e5) {
      this.formError = e5 instanceof Error ? e5.message : erplora5().t(CATALOG5, "ui.createStationError");
    } finally {
      this.saving = false;
    }
  }
  openEdit(st) {
    this.editing = st;
    this.editName = st.name;
    this.editPrinter = st.printer_name ?? "";
    this.editColor = st.color ?? "";
    this.editActive = Boolean(Number(st.is_active));
    this.formError = "";
    this.formMsg = "";
  }
  async saveEdit(ev) {
    ev.preventDefault();
    if (!this.editing) return;
    this.saving = true;
    this.formError = "";
    this.formMsg = "";
    try {
      await erplora5().command("kitchen.stations.update", {
        station_id: this.editing.id,
        name: this.editName.trim() || null,
        color: this.editColor.trim() || null,
        printer_name: this.editPrinter.trim(),
        is_active: this.editActive ? 1 : 0
      });
      this.formMsg = erplora5().t(CATALOG5, "ui.stationUpdated");
      this.editing = null;
      await this.reload();
    } catch (e5) {
      this.formError = e5 instanceof Error ? e5.message : erplora5().t(CATALOG5, "ui.updateStationError");
    } finally {
      this.saving = false;
    }
  }
  async saveRouting(ev) {
    ev.preventDefault();
    if (!this.routeStationId || !this.routeProductId && !this.routeCategoryId) return;
    this.saving = true;
    this.formError = "";
    this.formMsg = "";
    try {
      await erplora5().command("kitchen.stations.set_routing", {
        station_id: this.routeStationId,
        product_id: this.routeProductId,
        category_id: this.routeCategoryId
      });
      this.formMsg = erplora5().t(CATALOG5, "ui.routingSaved");
      this.routeProductId = "";
      this.routeCategoryId = "";
      await this.reload();
    } catch (e5) {
      this.formError = e5 instanceof Error ? e5.message : erplora5().t(CATALOG5, "ui.saveRoutingError");
    } finally {
      this.saving = false;
    }
  }
  async onRowAction(ev) {
    const station = ev.detail.row;
    if (ev.detail.actionId === "edit") {
      this.openEdit(station);
      return;
    }
    if (ev.detail.actionId === "route") {
      this.routeStationId = station.id;
      this.formError = "";
      this.formMsg = "";
      return;
    }
    if (ev.detail.actionId !== "delete") return;
    this.formError = "";
    this.formMsg = "";
    try {
      await erplora5().command("kitchen.stations.delete", { station_id: station.id });
      await this.reload();
    } catch (e5) {
      this.formError = e5 instanceof Error ? e5.message : erplora5().t(CATALOG5, "ui.deleteStationError");
    }
  }
  renderEditPanel() {
    if (!this.editing) return A;
    const t7 = (k2) => erplora5().t(CATALOG5, k2);
    return b2`<section class="panel">
      <h3>${t7("ui.editStationTitle")} · ${stationName(this.editing)}</h3>
      <form class="form" @submit=${(e5) => this.saveEdit(e5)}>
        <ion-input mode="md" fill="outline" label=${t7("ui.labelName")} label-placement="floating" .value=${this.editName} @ionInput=${(e5) => this.editName = e5.target.value}></ion-input>
        <ion-input mode="md" fill="outline" label=${t7("ui.labelColor")} label-placement="floating" placeholder="#F97316" .value=${this.editColor} @ionInput=${(e5) => this.editColor = e5.target.value}></ion-input>
        <ion-input mode="md" fill="outline" label=${t7("ui.labelPrinter")} label-placement="floating" .value=${this.editPrinter} @ionInput=${(e5) => this.editPrinter = e5.target.value}></ion-input>
        <ion-toggle .checked=${this.editActive} @ionChange=${(e5) => this.editActive = e5.detail.checked}>${t7("ui.labelActive")}</ion-toggle>
        <ion-button type="submit" size="small" ?disabled=${this.saving}>${this.saving ? t7("ui.saving") : t7("ui.save")}</ion-button>
        <ion-button size="small" fill="outline" @click=${() => this.editing = null}>${t7("ui.cancel")}</ion-button>
      </form>
    </section>`;
  }
  renderRoutingPanel() {
    const t7 = (k2) => erplora5().t(CATALOG5, k2);
    const stations = this.ctrl?.rows ?? [];
    return b2`<section class="panel">
      <h3>${t7("ui.routingTitle")}</h3>
      <form class="form" @submit=${(e5) => this.saveRouting(e5)}>
        <ion-select mode="md" fill="outline" label-placement="floating" label=${t7("ui.colStation")} .value=${this.routeStationId} @ionChange=${(e5) => this.routeStationId = e5.target.value}>
          ${stations.map((s5) => b2`<ion-select-option value=${s5.id}>${stationName(s5)}</ion-select-option>`)}
        </ion-select>
        <ion-select mode="md" fill="outline" interface="popover" label-placement="floating" label=${t7("ui.labelProduct")} placeholder=${t7("ui.placeholderOptional")} .value=${this.routeProductId} @ionChange=${(e5) => this.routeProductId = e5.target.value ?? ""}>
          ${this.productOptions.map((p4) => b2`<ion-select-option value=${p4.id}>${p4.name}</ion-select-option>`)}
        </ion-select>
        <ion-select mode="md" fill="outline" interface="popover" label-placement="floating" label=${t7("ui.labelCategory")} placeholder=${t7("ui.placeholderOptional")} .value=${this.routeCategoryId} @ionChange=${(e5) => this.routeCategoryId = e5.target.value ?? ""}>
          ${this.categoryOptions.map((c5) => b2`<ion-select-option value=${c5.id}>${c5.name}</ion-select-option>`)}
        </ion-select>
        <ion-button type="submit" size="small" ?disabled=${this.saving || !this.routeStationId || !this.routeProductId && !this.routeCategoryId}>${this.saving ? t7("ui.saving") : t7("ui.saveRouting")}</ion-button>
      </form>
    </section>`;
  }
  // El título de la vista lo pinta el topbar del shell: repetirlo aquí lo duplicaba en pantalla.
  // Los paneles de EDICIÓN y ENRUTADO se quedan fuera de la tabla: no dan de alta una fila, son
  // configuración (el enrutado producto/categoría → estación ni siquiera vive en la fila).
  render() {
    const t7 = (k2) => erplora5().t(CATALOG5, k2);
    return b2`<div class="page">
        ${this.renderEditPanel()}
        ${this.renderRoutingPanel()}
        ${this.formMsg ? b2`<p class="ok">${this.formMsg}</p>` : A}
        ${this.formError ? b2`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.formError}</ok-inline-feedback>` : A}
        ${this.ctrl?.error ? b2`<ok-inline-feedback tone="danger" icon="alert-circle-outline">${this.ctrl.error}</ok-inline-feedback>` : A}
        <ok-data-table .serverSide=${true} .fill=${true} .addable=${true} .columns=${this.columns} .views=${true} .cardTitle=${(r6) => stationName(r6)} .cardIcon=${() => "flame-outline"} .rows=${this.ctrl?.rows ?? []} .total=${this.ctrl?.total ?? 0} .page=${this.ctrl?.state.page ?? 0} .pageSize=${this.ctrl?.state.pageSize ?? 50} .sort=${this.ctrl?.state.sort} .sortDir=${this.ctrl?.state.dir ?? "asc"} .searchable=${true} .searchPlaceholder=${t7("ui.searchStations")} .emptyMessage=${this.ctrl?.loading ? t7("ui.loading") : t7("ui.emptyStations")} .actions=${this.rowActions} .rowClickable=${true} @rowAction=${(e5) => this.onRowAction(e5)} @rowClick=${(e5) => this.onRowAction({ detail: { actionId: "edit", row: e5.detail.row } })} @pageChange=${(e5) => this.ctrl.setPage(e5.detail)} @pageSizeChange=${(e5) => this.ctrl.setPageSize(e5.detail)} @sortChange=${(e5) => this.ctrl.setSort(e5.detail.sort, e5.detail.dir)} @searchChange=${(e5) => this.ctrl.setSearch(e5.detail)} @filterChange=${(e5) => this.ctrl.setFilter(e5.detail.col, e5.detail.value)}>
          <!-- Alta de estación: se proyecta SIEMPRE (aunque el panel esté cerrado); si se renderizara
               solo con el panel abierto, el «+» de la barra abriría un panel vacío. -->
          <form slot="create" class="create-form" @submit=${(e5) => this.createStation(e5)}>
            <ion-input mode="md" fill="outline" label-placement="floating" label=${t7("ui.labelName")} placeholder=${t7("ui.placeholderStationName")} .value=${this.newName} @ionInput=${(e5) => this.newName = e5.target.value}></ion-input>
            <ion-input mode="md" fill="outline" label-placement="floating" label=${t7("ui.labelPrinter")} placeholder=${t7("ui.placeholderPrinterOptional")} .value=${this.newPrinter} @ionInput=${(e5) => this.newPrinter = e5.target.value}></ion-input>
            <ion-button type="submit" ?disabled=${this.saving || !this.newName}>${this.saving ? t7("ui.saving") : t7("ui.addStation")}</ion-button>
          </form>
        </ok-data-table>
      </div>`;
  }
};
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "formError", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "formMsg", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "newName", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "newPrinter", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "saving", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "tick", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "editing", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "editName", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "editPrinter", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "editColor", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "editActive", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "routeStationId", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "routeProductId", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "routeCategoryId", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "productOptions", 2);
__decorateClass([
  r5()
], ErpKitchenOrdersStations.prototype, "categoryOptions", 2);
define("erp-kitchen-orders-stations", ErpKitchenOrdersStations);

// ui/components/erp-kitchen-pos-comandas/erp-kitchen-pos-comandas.ts
var CATALOG6 = { es: es_default, en: en_default };
function rows(r6) {
  if (Array.isArray(r6)) return r6;
  if (r6 && typeof r6 === "object" && Array.isArray(r6.rows)) return r6.rows;
  return [];
}
function erplora6() {
  const c5 = globalThis.erplora;
  if (!c5) throw new Error("erplora SDK no inicializado por el shell");
  return c5;
}
function t5(key, params) {
  const c5 = globalThis.erplora;
  return c5?.t ? c5.t(CATALOG6, key, params) : key;
}
var STATUS_KEY = {
  pending: "ui.stQueued",
  preparing: "ui.stPreparing",
  ready: "ui.stReady",
  served: "ui.stServed",
  paid: "ui.stPaid",
  cancelled: "ui.stCancelled"
};
var KDS_EVENTS = [
  "kitchen.order.created",
  "kitchen.order.fired",
  "kitchen.order.ready",
  "kitchen.order.served",
  "kitchen.order.recalled",
  "kitchen.order.cancelled",
  "kitchen.order.deleted"
];
var ErpKitchenPosComandas = class extends i3 {
  constructor() {
    super(...arguments);
    this.comandas = [];
    this.items = /* @__PURE__ */ new Map();
    this.open = false;
    this.offs = [];
    this.onPosState = (e5) => {
      const next = e5.detail?.order_id;
      if (next === this.orderId) return;
      this.orderId = next;
      void this.refresh();
    };
  }
  static {
    this.styles = i`
    :host { display: inline-flex; }
    .chip { display: inline-flex; align-items: center; gap: .3rem; border: 1px solid
      var(--ion-color-primary, #0091ce); color: var(--ion-color-primary, #0091ce);
      background: none; border-radius: var(--ok-radius-pill, 999px); padding: .15rem .6rem; font-size: .72rem;
      font-weight: 800; cursor: pointer; }
    .chip ion-icon { font-size: .9rem; }
    dialog.sheet { border: none; border-radius: var(--ok-radius-lg, 16px); padding: 1rem; width: min(94vw, 26rem);
      max-height: 85vh; overflow: auto; background: var(--ion-background-color, #fff);
      color: var(--ion-text-color, #1c1b18); box-shadow: 0 12px 48px rgba(0,0,0,.35); }
    dialog.sheet::backdrop { background: rgba(0,0,0,.45); }
    @media (max-width: 820px) {
      dialog.sheet { width: 100vw; max-width: 100vw; margin: auto 0 0;
        border-radius: var(--ok-radius-sheet-top, 18px 18px 0 0); padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
      dialog.sheet::before { content: ''; display: block; width: 2.4rem; height: .3rem;
        border-radius: var(--ok-radius-pill, 999px); background: rgba(0,0,0,.15); margin: 0 auto .7rem; }
    }
    .sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem; }
    .sheet-h .t { font-size: 1.1rem; font-weight: 700; }
    .x { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #8b897f; }
    .krow { border: 1px solid rgba(0,0,0,.12); border-radius: var(--ok-radius, 12px); margin-bottom: .5rem; overflow: hidden; }
    .krow-h { display: flex; align-items: center; gap: .4rem; padding: .5rem .7rem;
      font-weight: 700; font-size: .82rem; text-transform: uppercase; letter-spacing: .04em;
      background: rgba(0,0,0,.04); }
    .krow-h .ktime { color: #8b897f; font-weight: 400; text-transform: none; letter-spacing: 0; }
    .kstate { margin-left: auto; font-size: .62rem; font-weight: 800; padding: .1rem .45rem;
      border-radius: var(--ok-radius-pill, 999px); background: #e9ecef; color: #1c1b18; }
    .kstate[data-st='preparing'] { background: var(--ion-color-warning, #f5a623); }
    .kstate[data-st='ready'] { background: var(--ion-color-success, #2f9e44); color: #fff; }
    .kstate[data-st='served'] { background: #dee2e6; }
    .kstate[data-st='cancelled'] { background: var(--ion-color-danger, #d9480f); color: #fff; }
    .kitem { display: flex; gap: .5rem; padding: .35rem .7rem; font-size: .9rem; }
    .kitem .q { color: #8b897f; min-width: 2.2rem; }
  `;
  }
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("erp:pos-state", this.onPosState);
    const c5 = erplora6();
    if (typeof c5.on === "function") {
      this.offs = KDS_EVENTS.map((ev) => c5.on(ev, () => void this.refresh()));
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("erp:pos-state", this.onPosState);
    for (const off of this.offs) off();
    this.offs = [];
  }
  async refresh() {
    if (!this.orderId) {
      this.comandas = [];
      return;
    }
    try {
      const rows2 = await erplora6().queryAll("kitchen.orders.list", {
        filters: { source_order_id: this.orderId },
        sort: "round_number",
        dir: "desc"
      });
      this.comandas = [...rows2].sort((a3, b3) => (b3.round_number ?? 0) - (a3.round_number ?? 0));
    } catch {
      this.comandas = [];
    }
  }
  async openModal() {
    this.open = true;
    await this.updateComplete;
    const d3 = this.renderRoot.querySelector("dialog.sheet");
    if (d3 && !d3.open) {
      try {
        d3.showModal();
      } catch {
        d3.setAttribute("open", "");
      }
    }
    for (const c5 of this.comandas) {
      if (this.items.has(c5.id)) continue;
      try {
        const its = rows(await erplora6().query("kitchen.orders.items", { order_id: c5.id }));
        this.items = new Map(this.items).set(c5.id, its);
      } catch {
      }
    }
  }
  closeModal() {
    const d3 = this.renderRoot.querySelector("dialog.sheet");
    try {
      d3?.close();
    } catch {
    }
    this.open = false;
  }
  /** µ → texto legible (2, 0.5…) sin arrastrar ceros. La cocina habla punto fijo 10⁶ (ADR-0147). */
  qty(raw) {
    return String((Number(raw) || 0) / 1e6);
  }
  render() {
    if (!this.orderId || !this.comandas.length) return b2``;
    return b2`
      <button class="chip" title=${t5("ui.posComandasTitle")} aria-label=${t5("ui.posComandasTitle")}
              @click=${() => void this.openModal()}>
        <ion-icon name="receipt-outline"></ion-icon>
        ${t5("ui.posComandas")} · ${this.comandas.length}
      </button>
      ${this.open ? b2`
        <dialog class="sheet" aria-label=${t5("ui.posComandasTitle")}
                @click=${(e5) => {
      if (e5.target === e5.currentTarget) this.closeModal();
    }}
                @close=${() => {
      this.open = false;
    }}>
          <div class="sheet-h">
            <span class="t">${t5("ui.posComandasTitle")}</span>
            <button class="x" aria-label=${t5("ui.close")} @click=${() => this.closeModal()}>✕</button>
          </div>
          ${this.comandas.map((c5) => b2`
            <div class="krow">
              <div class="krow-h">
                <ion-icon name="flame" style="color: var(--ion-color-warning)"></ion-icon>
                <span>${t5("ui.comandaN", { n: String(c5.round_number) })}</span>
                <span class="ktime">· ${(c5.fired_at ?? c5.created_at ?? "").replace("T", " ").slice(11, 16)}</span>
                <span class="kstate" data-st=${c5.status}>${t5(STATUS_KEY[c5.status] ?? c5.status)}</span>
              </div>
              ${(this.items.get(c5.id) ?? []).map((i7) => b2`
                <div class="kitem"><span class="q">${this.qty(i7.quantity)}×</span><span>${i7.product_name}</span></div>`)}
            </div>`)}
        </dialog>` : A}`;
  }
};
__decorateClass([
  r5()
], ErpKitchenPosComandas.prototype, "orderId", 2);
__decorateClass([
  r5()
], ErpKitchenPosComandas.prototype, "comandas", 2);
__decorateClass([
  r5()
], ErpKitchenPosComandas.prototype, "items", 2);
__decorateClass([
  r5()
], ErpKitchenPosComandas.prototype, "open", 2);
define("erp-kitchen-pos-comandas", ErpKitchenPosComandas);

// ui/lib/pos-fire.ts
function pendingCount(state) {
  if (!state) return 0;
  return state.pending_count ?? state.items_count;
}
function canFire(state) {
  return pendingCount(state) > 0;
}

// ui/components/erp-kitchen-pos-fire/erp-kitchen-pos-fire.ts
var CATALOG7 = { es: es_default, en: en_default };
function t6(key) {
  const c5 = globalThis.erplora;
  return c5?.t ? c5.t(CATALOG7, key) : key;
}
var ErpKitchenPosFire = class extends i3 {
  constructor() {
    super(...arguments);
    this.urgent = false;
    this.onPosState = (e5) => {
      const previo = this.posState?.order_id;
      this.posState = e5.detail;
      if (this.posState?.order_id !== previo) this.urgent = false;
    };
  }
  static {
    this.styles = i`
    :host { display:flex; flex:1; min-width:0; gap:0.4rem; align-items:stretch; }
    /* Dentro de la vista temporal la acción ocupa todo el ancho: es la validación operativa de
       la comanda, no un icono secundario junto a Cobrar. El host decide dónde vive; kitchen sigue
       siendo dueño del control y de su disponibilidad (ADR-0043). */
    ion-button.fire { width:100%; min-height:3rem; margin:0; position:relative;
      font-weight:800; --border-radius:11px; }
    ion-button.fire ion-icon { font-size:1.15rem; }
    /* El interruptor de URGENTE va PEGADO a la acción que modifica, no perdido en otra barra: se
       decide y se envía en el mismo gesto. Armado se pinta en rojo y relleno — el estado tiene que
       leerse de lejos, con el local lleno y sin mirarlo fijo. */
    ion-button.urgent { width:3.1rem; min-height:3rem; margin:0; flex:0 0 auto;
      --border-radius:11px; --padding-start:0; --padding-end:0; }
    ion-button.urgent ion-icon { font-size:1.3rem; }
    /* pm#392 — the toggle paints from HERE, never from \`color=\`: Ionic resolves it through a
       GLOBAL \`.ion-color-*\` rule that does not reach inside this shadow root, so armed it came
       out with no red fill and unarmed in the default blue. Custom properties do inherit through
       the boundary, so the theme token still applies. Armed = solid (no \`fill\`), unarmed = outline. */
    ion-button.tone-danger:not([fill]) {
      --background: var(--ion-color-danger, #c5000f);
      --background-activated: var(--ion-color-danger-shade, #ad000d);
      --background-focused: var(--ion-color-danger-shade, #ad000d);
      --background-hover: var(--ion-color-danger-tint, #cb1a27);
      --color: var(--ion-color-danger-contrast, #fff);
    }
    ion-button.tone-medium[fill] {
      --border-color: var(--ion-color-medium, #636469);
      --color: var(--ion-color-medium, #636469);
      --background-activated: var(--ion-color-medium, #636469);
      --background-focused: var(--ion-color-medium, #636469);
    }
    /* Badge de PENDIENTES: cuánto queda sin marchar, de un vistazo. */
    .badge { position: absolute; top: -0.3rem; right: -0.3rem; z-index: 1; min-width: 1.1rem;
      height: 1.1rem; padding: 0 0.2rem; border-radius: var(--ok-radius-pill, 999px);
      background: var(--ion-color-warning, #f5a623); color: #1c1b18; font-size: 0.68rem;
      font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
  `;
  }
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("erp:pos-state", this.onPosState);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("erp:pos-state", this.onPosState);
  }
  fire() {
    if (!canFire(this.posState)) return;
    const detail = this.urgent ? { priority: "rush" } : {};
    this.urgent = false;
    this.dispatchEvent(new CustomEvent("erp:order-fire", { detail, bubbles: true, composed: true }));
  }
  render() {
    const label = this.urgent ? t6("ui.fireUrgent") : t6("ui.fireToKitchen");
    const urgentLabel = t6("ui.markUrgent");
    const pendientes = pendingCount(this.posState);
    return b2`
      <ion-button class=${this.urgent ? "urgent tone-danger" : "urgent tone-medium"}
                  fill=${this.urgent ? A : "outline"}
                  aria-pressed=${this.urgent ? "true" : "false"}
                  title=${urgentLabel} aria-label=${urgentLabel}
                  @click=${() => {
      this.urgent = !this.urgent;
    }}>
        <ion-icon slot="icon-only" name="flame-outline"></ion-icon>
      </ion-button>
      <ion-button class="fire" fill="outline" ?disabled=${!canFire(this.posState)}
                  title=${label} aria-label=${label}
                  @click=${() => this.fire()}>
        <ion-icon slot="start" name="send-outline"></ion-icon>
        <span>${label}</span>
        ${pendientes > 0 && this.posState?.pending_count !== void 0 ? b2`<span class="badge">${pendientes}</span>` : A}
      </ion-button>`;
  }
};
__decorateClass([
  r5()
], ErpKitchenPosFire.prototype, "posState", 2);
__decorateClass([
  r5()
], ErpKitchenPosFire.prototype, "urgent", 2);
define("erp-kitchen-pos-fire", ErpKitchenPosFire);
