System.register("common", [], function (exports_1, context_1) {
    "use strict";
    var CODE;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [],
        execute: function () {
            // common for all r submodules
            exports_1("CODE", CODE = '' + Math.random());
        }
    };
});
System.register("t", [], function (exports_2, context_2) {
    "use strict";
    var BuiltIns, DEBUG, SEALED_DEFAULT, isNone, typeCache;
    var __moduleName = context_2 && context_2.id;
    function T(parts, ...vals) {
        const cooked = vals.reduce((prev, cur, i) => prev + cur + parts[i + 1], parts[0]);
        const typeName = cooked;
        if (!typeCache.has(typeName))
            throw new TypeError(`Cannot use type ${typeName} before it is defined.`);
        return typeCache.get(typeName).type;
    }
    exports_2("T", T);
    function partialMatch(type, instance) {
        return validate(type, instance, { partial: true });
    }
    function validate(type, instance, { partial: partial = false } = {}) {
        guardType(type);
        guardExists(type);
        const typeName = type.name;
        const { spec, kind, help, verify, verifiers, sealed } = typeCache.get(typeName);
        const specKeyPaths = spec ? allKeyPaths(spec).sort() : [];
        const specKeyPathSet = new Set(specKeyPaths);
        const bigErrors = [];
        switch (kind) {
            case "def": {
                let allValid = true;
                if (spec) {
                    const keyPaths = partial ? allKeyPaths(instance, specKeyPathSet) : specKeyPaths;
                    allValid = !isNone(instance) && keyPaths.every(kp => {
                        // Allow lookup errors if the type match for the key path can include None
                        const { resolved, errors: lookupErrors } = lookup(instance, kp, () => checkTypeMatch(lookup(spec, kp).resolved, T `None`));
                        bigErrors.push(...lookupErrors);
                        if (lookupErrors.length)
                            return false;
                        const keyType = lookup(spec, kp).resolved;
                        if (!keyType || !(keyType instanceof Type)) {
                            bigErrors.push({
                                error: `Key path '${kp}' is not present in the spec for type '${typeName}'`
                            });
                            return false;
                        }
                        const { valid, errors: validationErrors } = validate(keyType, resolved);
                        bigErrors.push(...validationErrors);
                        return valid;
                    });
                }
                let verified = true;
                if (partial && !spec && !!verify) {
                    throw new TypeError(`Type checking with option 'partial' is not a valid option for types that` +
                        ` only use a verify function but have no spec`);
                }
                else if (verify) {
                    try {
                        verified = verify(instance);
                        if (!verified) {
                            if (verifiers) {
                                throw {
                                    error: `Type ${typeName} value '${JSON.stringify(instance)}' violated at least 1 verify function in:\n${verifiers.map(f => '\t' + (f.help || '') + ' (' + f.verify.toString() + ')').join('\n')}`
                                };
                            }
                            else if (type.isSumType) {
                                throw {
                                    error: `Value '${JSON.stringify(instance)}' did not match any of: ${[...type.types.keys()].map(t => t.name)}`,
                                    verify, verifiers
                                };
                            }
                            else {
                                let helpMsg = '';
                                if (help) {
                                    helpMsg = `Help: ${help}. `;
                                }
                                throw { error: `${helpMsg}Type ${typeName} Value '${JSON.stringify(instance)}' violated verify function in: ${verify.toString()}` };
                            }
                        }
                    }
                    catch (e) {
                        bigErrors.push(e);
                        verified = false;
                    }
                }
                let sealValid = true;
                if (!!sealed && !!spec) {
                    const type_key_paths = specKeyPaths;
                    const all_key_paths = allKeyPaths(instance, specKeyPathSet).sort();
                    sealValid = all_key_paths.join(',') == type_key_paths.join(',');
                    if (!sealValid) {
                        if (all_key_paths.length < type_key_paths.length) {
                            sealValid = true;
                        }
                        else {
                            const errorKeys = [];
                            const tkp = new Set(type_key_paths);
                            for (const k of all_key_paths) {
                                if (!tkp.has(k)) {
                                    errorKeys.push({
                                        error: `Key path '${k}' is not in the spec for type ${typeName}`
                                    });
                                }
                            }
                            if (errorKeys.length) {
                                bigErrors.push(...errorKeys);
                            }
                        }
                    }
                }
                return { valid: allValid && verified && sealValid, errors: bigErrors, partial };
            }
            case "defCollection": {
                const { valid: containerValid, errors: containerErrors } = validate(spec.container, instance);
                let membersValid = true;
                let verified = true;
                bigErrors.push(...containerErrors);
                if (partial) {
                    throw new TypeError(`Type checking with option 'partial' is not a valid option for Collection types`);
                }
                else {
                    if (containerValid) {
                        membersValid = [...instance].every(member => {
                            const { valid, errors } = validate(spec.member, member);
                            bigErrors.push(...errors);
                            return valid;
                        });
                    }
                    if (verify) {
                        try {
                            verified = verify(instance);
                        }
                        catch (e) {
                            bigErrors.push(e);
                            verified = false;
                        }
                    }
                }
                return { valid: containerValid && membersValid && verified, errors: bigErrors };
            }
            default: {
                throw new TypeError(`Checking for type kind ${kind} is not yet implemented.`);
            }
        }
    }
    function check(...args) {
        return validate(...args).valid;
    }
    function lookup(obj, keyPath, canBeNone) {
        if (isNone(obj))
            throw new TypeError(`Lookup requires a non-unset object.`);
        if (!keyPath)
            throw new TypeError(`keyPath must not be empty`);
        const keys = keyPath.split(/\./g);
        const pathComplete = [];
        const errors = [];
        let resolved = obj;
        while (keys.length) {
            const nextKey = keys.shift();
            resolved = resolved[nextKey];
            pathComplete.push(nextKey);
            if ((resolved === null || resolved === undefined)) {
                if (keys.length) {
                    errors.push({
                        error: `Lookup on key path '${keyPath}' failed at '` +
                            pathComplete.join('.') +
                            `' when ${resolved} was found at '${nextKey}'.`
                    });
                }
                else if (!!canBeNone && canBeNone()) {
                    resolved = undefined;
                }
                else {
                    errors.push({
                        error: `Resolution on key path '${keyPath}' failed` +
                            `when ${resolved} was found at '${nextKey}' and the Type of this` +
                            `key's value cannot be None.`
                    });
                }
                break;
            }
        }
        return { resolved, errors };
    }
    function checkTypeMatch(typeA, typeB) {
        guardType(typeA);
        guardExists(typeA);
        guardType(typeB);
        guardExists(typeB);
        if (typeA === typeB) {
            return true;
        }
        else if (typeA.isSumType && typeA.types.has(typeB)) {
            return true;
        }
        else if (typeB.isSumType && typeB.types.has(typeA)) {
            return true;
        }
        else if (typeA.name.startsWith('?') && typeB == T `None`) {
            return true;
        }
        else if (typeB.name.startsWith('?') && typeA == T `None`) {
            return true;
        }
        if (typeA.name.startsWith('>') || typeB.name.startsWith('>')) {
            console.error(new Error(`Check type match has not been implemented for derived//sub types yet.`));
        }
        return false;
    }
    function option(type) {
        return T `?${type.name}`;
    }
    function sub(type) {
        return T `>${type.name}`;
    }
    function defSub(type, spec, { verify: verify = undefined, help: help = '' } = {}, name = '') {
        guardType(type);
        guardExists(type);
        let verifiers;
        if (!verify) {
            verify = () => true;
        }
        if (type.native) {
            verifiers = [{ help, verify }];
            verify = i => i instanceof type.native;
            const helpMsg = `Needs to be of type ${type.native.name}. ${help || ''}`;
            verifiers.push({ help: helpMsg, verify });
        }
        const newType = def(`${name}>${type.name}`, spec, { verify, help, verifiers });
        return newType;
    }
    function defEnum(name, ...values) {
        if (!name)
            throw new TypeError(`Type must be named.`);
        guardRedefinition(name);
        const valueSet = new Set(values);
        const verify = i => valueSet.has(i);
        const help = `Value of Enum type ${name} must be one of ${values.join(',')}`;
        return def(name, null, { verify, help });
    }
    function exists(name) {
        return typeCache.has(name);
    }
    function guardRedefinition(name) {
        if (exists(name))
            throw new TypeError(`Type ${name} cannot be redefined.`);
    }
    function allKeyPaths(o, specKeyPaths) {
        const isTypeSpec = !specKeyPaths;
        const keyPaths = new Set();
        return recurseObject(o, keyPaths, '');
        function recurseObject(o, keyPathSet, lastLevel = '') {
            const levelKeys = Object.getOwnPropertyNames(o);
            const keyPaths = levelKeys
                .map(k => lastLevel + (lastLevel.length ? '.' : '') + k);
            levelKeys.forEach((k, i) => {
                const v = o[k];
                if (isTypeSpec) {
                    if (v instanceof Type) {
                        keyPathSet.add(keyPaths[i]);
                    }
                    else if (typeof v == "object") {
                        if (!Array.isArray(v)) {
                            recurseObject(v, keyPathSet, keyPaths[i]);
                        }
                        else {
                            DEBUG && console.warn({ o, v, keyPathSet, lastLevel });
                            throw new TypeError(`We don't support Types that use Arrays as structure, just yet.`);
                        }
                    }
                    else {
                        throw new TypeError(`Spec cannot contain leaf values that are not valid Types`);
                    }
                }
                else {
                    if (specKeyPaths.has(keyPaths[i])) {
                        keyPathSet.add(keyPaths[i]);
                    }
                    else if (typeof v == "object") {
                        if (!Array.isArray(v)) {
                            recurseObject(v, keyPathSet, keyPaths[i]);
                        }
                        else {
                            v.forEach((item, index) => recurseObject(item, keyPathSet, keyPaths[i] + '.' + index));
                            //throw new TypeError(`We don't support Instances that use Arrays as structure, just yet.`); 
                        }
                    }
                    else {
                        //console.warn("Spec has no such key",  keyPaths[i]);
                        keyPathSet.add(keyPaths[i]);
                    }
                }
            });
            return [...keyPathSet];
        }
    }
    function defOption(type) {
        guardType(type);
        const typeName = type.name;
        return T.def(`?${typeName}`, null, { verify: i => isUnset(i) || T.check(type, i) });
    }
    function maybe(type) {
        try {
            return defOption(type);
        }
        catch (e) {
            // console.log(`Option Type ${type.name} already declared.`, e);
        }
        return T `?${type.name}`;
    }
    function verify(...args) { return check(...args); }
    function defCollection(name, { container, member }, { sealed: sealed = SEALED_DEFAULT, verify: verify = undefined } = {}) {
        if (!name)
            throw new TypeError(`Type must be named.`);
        if (!container || !member)
            throw new TypeError(`Type must be specified.`);
        guardRedefinition(name);
        const kind = 'defCollection';
        const t = new Type(name);
        const spec = { kind, spec: { container, member }, verify, sealed, type: t };
        typeCache.set(name, spec);
        return t;
    }
    function defTuple(name, { pattern }) {
        if (!name)
            throw new TypeError(`Type must be named.`);
        if (!pattern)
            throw new TypeError(`Type must be specified.`);
        const kind = 'def';
        const specObj = {};
        pattern.forEach((type, key) => specObj[key] = type);
        const t = new Type(name);
        const spec = { kind, spec: specObj, type: t };
        typeCache.set(name, spec);
        return t;
    }
    function Type(name, mods = {}) {
        if (!new.target)
            throw new TypeError(`Type with new only.`);
        Object.defineProperty(this, 'name', { get: () => name });
        this.typeName = name;
        if (mods.types) {
            const { types } = mods;
            const typeSet = new Set(types);
            Object.defineProperty(this, 'isSumType', { get: () => true });
            Object.defineProperty(this, 'types', { get: () => typeSet });
        }
        if (mods.native) {
            const { native } = mods;
            Object.defineProperty(this, 'native', { get: () => native });
        }
    }
    function def(name, spec, { help: help = '', verify: verify = undefined, sealed: sealed = undefined, types: types = undefined, verifiers: verifiers = undefined, native: native = undefined } = {}) {
        if (!name)
            throw new TypeError(`Type must be named.`);
        guardRedefinition(name);
        if (name.startsWith('?')) {
            if (spec) {
                throw new TypeError(`Option type can not have a spec.`);
            }
            if (!verify(null)) {
                throw new TypeError(`Option type must be OK to be unset.`);
            }
        }
        const kind = 'def';
        if (sealed === undefined) {
            sealed = true;
        }
        const t = new Type(name, { types, native });
        const cache = { spec, kind, help, verify, verifiers, sealed, types, native, type: t };
        typeCache.set(name, cache);
        return t;
    }
    function defOr(name, ...types) {
        return T.def(name, null, { types, verify: i => types.some(t => check(t, i)) });
    }
    function guard(type, instance) {
        guardType(type);
        guardExists(type);
        const { valid, errors } = validate(type, instance);
        if (!valid)
            throw new TypeError(`Type ${type} requested, but item is not of that type: ${errors.join(', ')}`);
    }
    function guardType(t) {
        //console.log(t);
        if (!(t instanceof Type))
            throw new TypeError(`Type must be a valid Type object.`);
    }
    function guardExists(t) {
        const name = originalName(t);
        if (!exists(name))
            throw new TypeError(`Type must exist. Type ${name} has not been defined.`);
    }
    function errors(...args) {
        return validate(...args).errors;
    }
    function mapBuiltins() {
        BuiltIns.forEach(t => def(originalName(t), null, { native: t, verify: i => originalName(i.constructor) === originalName(t) }));
        BuiltIns.forEach(t => defSub(T `${originalName(t)}`));
    }
    function defineSpecials() {
        T.def(`Any`, null, { verify: () => true });
        T.def(`Some`, null, { verify: i => !isUnset(i) });
        T.def(`None`, null, { verify: i => isUnset(i) });
        T.def(`Function`, null, { verify: i => i instanceof Function });
        T.def(`Integer`, null, { verify: i => Number.isInteger(i) });
        T.def(`Array`, null, { verify: i => Array.isArray(i) });
        T.def(`Iterable`, null, { verify: i => i[Symbol.iterator] instanceof Function });
    }
    function isUnset(i) {
        return i === null || i === undefined;
    }
    function originalName(t) {
        if (!!t && t.name) {
            return t.name;
        }
        const oName = Object.prototype.toString.call(t).replace(/\[object |\]/g, '');
        if (oName.endsWith('Constructor')) {
            return oName.replace(/Constructor$/, '');
        }
        return oName;
    }
    return {
        setters: [],
        execute: function () {
            BuiltIns = [
                Symbol, Boolean, Number, String, Object, Set, Map, WeakMap, WeakSet,
                Uint8Array, Uint16Array, Uint32Array, Float32Array, Float64Array,
                Int8Array, Int16Array, Int32Array,
                Uint8ClampedArray,
                Node, NodeList, Element, HTMLElement, Blob, ArrayBuffer,
                FileList, Text, HTMLDocument, Document, DocumentFragment,
                Error, File, Event, EventTarget, URL
            ];
            DEBUG = false;
            SEALED_DEFAULT = true;
            isNone = instance => instance == null || instance == undefined;
            typeCache = new Map();
            T.def = def;
            T.check = check;
            T.sub = sub;
            T.verify = verify;
            T.validate = validate;
            T.partialMatch = partialMatch;
            T.defEnum = defEnum;
            T.defSub = defSub;
            T.defTuple = defTuple;
            T.defCollection = defCollection;
            T.defOr = defOr;
            T.option = option;
            T.defOption = defOption;
            T.maybe = maybe;
            T.guard = guard;
            T.errors = errors;
            // debug
            if (DEBUG) {
                self.T = T;
                self.typeCache = typeCache;
            }
            T[Symbol.for('jtype-system.typeCache')] = typeCache;
            defineSpecials();
            mapBuiltins();
            Type.prototype.toString = function () {
                return `${this.typeName} Type`;
            };
        }
    };
});
System.register("types", ["t", "common"], function (exports_3, context_3) {
    "use strict";
    var t_js_1, common_js_1, TKey, THandlers, TFuncArray, TEmptyArray, TMarkupObject, TMarkupAttrObject, TBrutalLikeObject, TBrutalObject, TBrutalArray, TSBrutalObject, TSBrutalArray, BS, SSR, Types;
    var __moduleName = context_3 && context_3.id;
    // verify function 
    function verify(v) {
        return common_js_1.CODE === v.code;
    }
    return {
        setters: [
            function (t_js_1_1) {
                t_js_1 = t_js_1_1;
            },
            function (common_js_1_1) {
                common_js_1 = common_js_1_1;
            }
        ],
        execute: function () {
            exports_3("default", t_js_1.T);
            // Both SSR and Browser
            exports_3("TKey", TKey = t_js_1.T.def('Key', {
                key: t_js_1.T.defOr('ValidKey', t_js_1.T `String`, t_js_1.T `Number`)
            }));
            exports_3("THandlers", THandlers = t_js_1.T.def('Handlers', null, { verify: i => {
                    const validObject = t_js_1.T.check(t_js_1.T `Object`, i);
                    if (!validObject)
                        return false;
                    const eventNames = Object.keys(i);
                    const handlerFuncs = Object.values(i);
                    const validNames = eventNames.every(name => t_js_1.T.check(t_js_1.T `String`, name));
                    const validFuncs = handlerFuncs.every(func => t_js_1.T.check(t_js_1.T `Function`, func));
                    const valid = validNames && validFuncs;
                    return valid;
                } }));
            exports_3("TFuncArray", TFuncArray = t_js_1.T.defCollection('FuncArray', {
                container: t_js_1.T `Array`,
                member: t_js_1.T `Function`
            }));
            exports_3("TEmptyArray", TEmptyArray = t_js_1.T.def('EmptyArray', null, { verify: i => Array.isArray(i) && i.length == 0 }));
            exports_3("TMarkupObject", TMarkupObject = t_js_1.T.def('MarkupObject', {
                type: t_js_1.T `String`,
                code: t_js_1.T `String`,
                nodes: t_js_1.T `Array`,
                externals: t_js_1.T `Array`,
            }, { verify: v => v.type == 'MarkupObject' && v.code == common_js_1.CODE }));
            exports_3("TMarkupAttrObject", TMarkupAttrObject = t_js_1.T.def('MarkupAttrObject', {
                type: t_js_1.T `String`,
                code: t_js_1.T `String`,
                str: t_js_1.T `String`
            }, { verify: v => v.type == 'MarkupAttrObject' && v.code == common_js_1.CODE }));
            // Browser side
            exports_3("TBrutalLikeObject", TBrutalLikeObject = t_js_1.T.def('BrutalLikeObject', {
                code: t_js_1.T `String`,
                externals: t_js_1.T `Array`,
                nodes: t_js_1.T `Array`,
                to: t_js_1.T `Function`,
                update: t_js_1.T `Function`,
                v: t_js_1.T `Array`,
                oldVals: t_js_1.T `Array`
            }));
            exports_3("TBrutalObject", TBrutalObject = t_js_1.T.def('BrutalObject', {
                code: t_js_1.T `String`,
                externals: t_js_1.T `Array`,
                nodes: t_js_1.T `Array`,
                to: t_js_1.T `Function`,
                update: t_js_1.T `Function`,
                v: t_js_1.T `Array`,
                oldVals: t_js_1.T `Array`
            }, { verify: v => verify(v) }));
            exports_3("TBrutalArray", TBrutalArray = t_js_1.T.defCollection('BrutalArray', {
                container: t_js_1.T `Array`,
                member: t_js_1.T `BrutalObject`
            }));
            // SSR
            exports_3("TSBrutalObject", TSBrutalObject = t_js_1.T.def('SBrutalObject', {
                str: t_js_1.T `String`,
                handlers: THandlers
            }));
            exports_3("TSBrutalArray", TSBrutalArray = t_js_1.T.defCollection('SBrutalArray', {
                container: t_js_1.T `Array`,
                member: t_js_1.T `SBrutalObject`
            }));
            // export
            exports_3("BS", BS = { TKey, THandlers, TFuncArray, TBrutalObject, TBrutalLikeObject, TBrutalArray });
            exports_3("SSR", SSR = { TKey, THandlers, TFuncArray, TSBrutalObject, TSBrutalArray });
            exports_3("Types", Types = { BS, SSR });
        }
    };
});
System.register("r", ["common", "types"], function (exports_4, context_4) {
    "use strict";
    var common_js_2, types_js_1, skip, attrskip, DEBUG, NULLFUNC, KEYMATCH, ATTRMATCH, KEYLEN, XSS, OBJ, UNSET, INSERT, NOTFOUND, MOVE, isKey, isHandlers, cache, d, e, u, x;
    var __moduleName = context_4 && context_4.id;
    function R(p, ...v) {
        return exoteric(p, v);
    }
    exports_4("R", R);
    function X(p, ...v) {
        return exoteric(p, v, { useCache: false });
    }
    exports_4("X", X);
    // main function (TODO: should we refactor?)
    function exoteric(p, v, { useCache: useCache = true } = {}) {
        const retVal = {};
        let instanceKey, cacheKey;
        v = v.map(guardAndTransformVal);
        if (useCache) {
            ({ key: instanceKey } = (v.find(isKey) || {}));
            cacheKey = p.join('<link rel=join>');
            const { cached, firstCall } = isCached(cacheKey, v, instanceKey);
            if (!firstCall) {
                cached.update(v);
                return cached;
            }
            else {
                retVal.oldVals = Array.from(v);
            }
        }
        else {
            retVal.oldVals = Array.from(v);
        }
        // compile the template into an updater
        p = [...p];
        const vmap = {};
        const V = v.map(replaceValWithKeyAndOmitInstanceKey(vmap));
        const externals = [];
        let str = '';
        while (p.length > 1)
            str += p.shift() + V.shift();
        str += p.shift();
        const frag = toDOM(str);
        const walker = document.createTreeWalker(frag, NodeFilter.SHOW_ALL);
        do {
            makeUpdaters({ walker, vmap, externals });
        } while (walker.nextNode());
        Object.assign(retVal, {
            externals,
            v: Object.values(vmap),
            to,
            update,
            code: common_js_2.CODE,
            nodes: [...frag.childNodes]
        });
        if (useCache) {
            if (instanceKey) {
                cache[cacheKey].instances[instanceKey] = retVal;
            }
            else {
                cache[cacheKey] = retVal;
            }
        }
        return retVal;
    }
    // to function
    function to(location, options) {
        const position = (options || 'replace').toLocaleLowerCase();
        const frag = document.createDocumentFragment();
        this.nodes.forEach(n => frag.appendChild(n));
        const isNode = types_js_1.default.check(types_js_1.default `>Node`, location);
        const elem = isNode ? location : document.querySelector(location);
        try {
            MOVE[position](frag, elem);
        }
        catch (e) {
            DEBUG && console.log({ location, options, e, elem, isNode });
            DEBUG && console.warn(e);
            switch (e.constructor && e.constructor.name) {
                case "DOMException":
                    die({ error: INSERT() }, e);
                    break;
                case "TypeError":
                    die({ error: NOTFOUND(location) }, e);
                    break;
                default: throw e;
            }
        }
        while (this.externals.length) {
            this.externals.shift()();
        }
    }
    // update functions
    function makeUpdaters({ walker, vmap, externals }) {
        const node = walker.currentNode;
        switch (node.nodeType) {
            case Node.ELEMENT_NODE:
                handleElement({ node, vmap, externals });
                break;
            case Node.COMMENT_NODE:
            case Node.TEXT_NODE:
                handleNode({ node, vmap, externals });
                break;
        }
    }
    function handleNode({ node, vmap, externals }) {
        const lengths = [];
        const text = node.nodeValue;
        let result = KEYMATCH.exec(text);
        while (result) {
            const { index } = result;
            const key = result[1];
            const val = vmap[key];
            const replacer = makeNodeUpdater({ node, index, lengths, val });
            externals.push(() => replacer(val.val));
            val.replacers.push(replacer);
            result = KEYMATCH.exec(text);
        }
    }
    // node functions
    function makeNodeUpdater(nodeState) {
        const { node } = nodeState;
        const scope = Object.assign({}, nodeState, {
            oldVal: { length: KEYLEN },
            oldNodes: [node],
            lastAnchor: node,
        });
        return (newVal) => {
            if (scope.oldVal == newVal)
                return;
            scope.val.val = newVal;
            switch (getType(newVal)) {
                case "markupobject":
                case "brutalobject":
                    handleMarkupInNode(newVal, scope);
                    break;
                default:
                    handleTextInNode(newVal, scope);
                    break;
            }
        };
    }
    function handleMarkupInNode(newVal, state) {
        let { oldNodes, lastAnchor } = state;
        if (newVal.nodes.length) {
            if (sameOrder(oldNodes, newVal.nodes)) {
                // do nothing
            }
            else {
                Array.from(newVal.nodes).reverse().forEach(n => {
                    lastAnchor.parentNode.insertBefore(n, lastAnchor.nextSibling);
                    state.lastAnchor = lastAnchor.nextSibling;
                });
                state.lastAnchor = newVal.nodes[0];
            }
        }
        else {
            const placeholderNode = summonPlaceholder(lastAnchor);
            lastAnchor.parentNode.insertBefore(placeholderNode, lastAnchor.nextSibling);
            state.lastAnchor = placeholderNode;
        }
        // MARK: Unbond event might be relevant here.
        const dn = diffNodes(oldNodes, newVal.nodes);
        if (dn.size) {
            const f = document.createDocumentFragment();
            dn.forEach(n => f.appendChild(n));
        }
        state.oldNodes = newVal.nodes || [lastAnchor];
        while (newVal.externals.length) {
            const func = newVal.externals.shift();
            func();
        }
    }
    function sameOrder(nodesA, nodesB) {
        if (nodesA.length != nodesB.length)
            return false;
        return Array.from(nodesA).every((an, i) => an == nodesB[i]);
    }
    function handleTextInNode(newVal, state) {
        let { oldVal, index, val, lengths, node } = state;
        const valIndex = val.vi;
        const originalLengthBefore = Object.keys(lengths.slice(0, valIndex)).length * KEYLEN;
        const lengthBefore = lengths.slice(0, valIndex).reduce((sum, x) => sum + x, 0);
        const value = node.nodeValue;
        lengths[valIndex] = newVal.length;
        const correction = lengthBefore - originalLengthBefore;
        const before = value.slice(0, index + correction);
        const after = value.slice(index + correction + oldVal.length);
        const newValue = before + newVal + after;
        node.nodeValue = newValue;
        state.oldVal = newVal;
    }
    // element attribute functions
    function handleElement({ node, vmap, externals }) {
        getAttributes(node).forEach(({ name, value } = {}) => {
            const attrState = { node, vmap, externals, name, lengths: [] };
            KEYMATCH.lastIndex = 0;
            let result = KEYMATCH.exec(name);
            while (result) {
                prepareAttributeUpdater(result, attrState, { updateName: true });
                result = KEYMATCH.exec(name);
            }
            KEYMATCH.lastIndex = 0;
            result = KEYMATCH.exec(value);
            while (result) {
                prepareAttributeUpdater(result, attrState, { updateName: false });
                result = KEYMATCH.exec(value);
            }
        });
    }
    function prepareAttributeUpdater(result, attrState, { updateName }) {
        const { index, input } = result;
        const scope = Object.assign({}, attrState, {
            index, input, updateName,
            val: attrState.vmap[result[1]],
            oldVal: { length: KEYLEN },
            oldName: attrState.name,
        });
        let replacer;
        if (updateName) {
            replacer = makeAttributeNameUpdater(scope);
        }
        else {
            replacer = makeAttributeValueUpdater(scope);
        }
        scope.externals.push(() => replacer(scope.val.val));
        scope.val.replacers.push(replacer);
    }
    // FIXME: needs to support multiple replacements just like value
    // QUESTION: why is the variable oldName so required here, why can't we call it oldVal?
    // if we do it breaks, WHY?
    function makeAttributeNameUpdater(scope) {
        let { oldName, node, val } = scope;
        return (newVal) => {
            if (oldName == newVal)
                return;
            val.val = newVal;
            const attr = node.hasAttribute(oldName) ? oldName : '';
            if (attr !== newVal) {
                if (attr) {
                    node.removeAttribute(oldName);
                    node[oldName] = undefined;
                }
                if (newVal) {
                    newVal = newVal.trim();
                    let name = newVal, value = undefined;
                    if (ATTRMATCH.test(newVal)) {
                        const assignmentIndex = newVal.indexOf('=');
                        ([name, value] = [newVal.slice(0, assignmentIndex), newVal.slice(assignmentIndex + 1)]);
                    }
                    reliablySetAttribute(node, name, value);
                }
                oldName = newVal;
            }
        };
    }
    function makeAttributeValueUpdater(scope) {
        return (newVal) => {
            if (scope.oldVal == newVal)
                return;
            scope.val.val = newVal;
            switch (getType(newVal)) {
                case "funcarray":
                    updateAttrWithFuncarrayValue(newVal, scope);
                    break;
                case "function":
                    updateAttrWithFunctionValue(newVal, scope);
                    break;
                case "handlers":
                    updateAttrWithHandlersValue(newVal, scope);
                    break;
                case "markupobject":
                case "brutalobject":
                    newVal = nodesToStr(newVal.nodes);
                    updateAttrWithTextValue(newVal, scope);
                    break;
                /* eslint-disable no-fallthrough */
                case "markupattrobject": // deliberate fall through
                    newVal = newVal.str;
                default:
                    updateAttrWithTextValue(newVal, scope);
                    break;
                /* eslint-enable no-fallthrough */
            }
        };
    }
    // helpers
    function getAttributes(node) {
        if (!node.hasAttribute)
            return [];
        // for parity with classList.add (which trims whitespace)
        // otherwise once the classList manipulation happens
        // our indexes for replacement will be off
        if (node.hasAttribute('class')) {
            node.setAttribute('class', formatClassListValue(node.getAttribute('class')));
        }
        if (!!node.attributes && Number.isInteger(node.attributes.length))
            return Array.from(node.attributes);
        const attrs = [];
        for (const name of node) {
            if (node.hasAttribute(name)) {
                attrs.push({ name, value: node.getAttribute(name) });
            }
        }
        return attrs;
    }
    function updateAttrWithFunctionValue(newVal, scope) {
        let { oldVal, node, name, externals } = scope;
        if (name !== 'bond') {
            let flags = {};
            if (name.includes(':')) {
                ([name, ...flags] = name.split(':'));
                flags = flags.reduce((O, f) => {
                    O[f] = true;
                    return O;
                }, {});
            }
            if (oldVal) {
                node.removeEventListener(name, oldVal, flags);
            }
            node.addEventListener(name, newVal, flags);
        }
        else {
            if (oldVal) {
                const index = externals.indexOf(oldVal);
                if (index >= 0) {
                    externals.splice(index, 1);
                }
            }
            externals.push(() => newVal(node));
        }
        scope.oldVal = newVal;
    }
    function updateAttrWithFuncarrayValue(newVal, scope) {
        let { oldVal, node, name, externals } = scope;
        if (oldVal && !Array.isArray(oldVal)) {
            oldVal = [oldVal];
        }
        if (name !== 'bond') {
            let flags = {};
            if (name.includes(':')) {
                ([name, ...flags] = name.split(':'));
                flags = flags.reduce((O, f) => {
                    O[f] = true;
                    return O;
                }, {});
            }
            if (oldVal) {
                oldVal.forEach(of => node.removeEventListener(name, of, flags));
            }
            newVal.forEach(f => node.addEventListener(name, f, flags));
        }
        else {
            if (oldVal) {
                oldVal.forEach(of => {
                    const index = externals.indexOf(of);
                    if (index >= 0) {
                        externals.splice(index, 1);
                    }
                });
            }
            newVal.forEach(f => externals.push(() => f(node)));
        }
        scope.oldVal = newVal;
    }
    function updateAttrWithHandlersValue(newVal, scope) {
        let { oldVal, node, externals, } = scope;
        if (!!oldVal && types_js_1.default.check(types_js_1.default `Handlers`, oldVal)) {
            Object.entries(oldVal).forEach(([eventName, funcVal]) => {
                if (eventName !== 'bond') {
                    let flags = {};
                    if (eventName.includes(':')) {
                        ([eventName, ...flags] = eventName.split(':'));
                        flags = flags.reduce((O, f) => {
                            O[f] = true;
                            return O;
                        }, {});
                    }
                    console.log(eventName, funcVal, flags);
                    node.removeEventListener(eventName, funcVal, flags);
                }
                else {
                    const index = externals.indexOf(funcVal);
                    if (index >= 0) {
                        externals.splice(index, 1);
                    }
                }
            });
        }
        Object.entries(newVal).forEach(([eventName, funcVal]) => {
            if (eventName !== 'bond') {
                let flags = {};
                if (eventName.includes(':')) {
                    ([eventName, ...flags] = eventName.split(':'));
                    flags = flags.reduce((O, f) => {
                        O[f] = true;
                        return O;
                    }, {});
                }
                node.addEventListener(eventName, funcVal, flags);
            }
            else {
                externals.push(() => funcVal(node));
            }
        });
        scope.oldVal = newVal;
    }
    function updateAttrWithTextValue(newVal, scope) {
        let { oldVal, node, index, name, val, lengths } = scope;
        let zeroWidthCorrection = 0;
        const valIndex = val.vi;
        const originalLengthBefore = Object.keys(lengths.slice(0, valIndex)).length * KEYLEN;
        // we need to trim newVal to have parity with classlist add
        // the reason we have zeroWidthCorrection = -1
        // is because the classList is a set of non-zero width tokens
        // separated by spaces
        // when we have a zero width token, we have two adjacent spaces
        // which, by virtue of our other requirement, gets replaced by a single space
        // effectively elliding out our replacement location
        // in order to keep our replacement location in tact
        // we need to compensate for the loss of a token slot (effectively a token + a space)
        // and having a -1 correction effectively does this.
        if (name == "class") {
            newVal = newVal.trim();
            if (newVal.length == 0) {
                zeroWidthCorrection = -1;
            }
            scope.val.val = newVal;
        }
        lengths[valIndex] = newVal.length + zeroWidthCorrection;
        let attr = node.getAttribute(name);
        const lengthBefore = lengths.slice(0, valIndex).reduce((sum, x) => sum + x, 0);
        const correction = lengthBefore - originalLengthBefore;
        const before = attr.slice(0, index + correction);
        const after = attr.slice(index + correction + oldVal.length);
        let newAttrValue;
        if (name == "class") {
            const spacer = oldVal.length == 0 ? ' ' : '';
            newAttrValue = before + spacer + newVal + spacer + after;
        }
        else {
            newAttrValue = before + newVal + after;
        }
        DEBUG && console.log(JSON.stringify({
            newVal,
            valIndex,
            lengths,
            attr,
            lengthBefore,
            originalLengthBefore,
            correction,
            before,
            after,
            newAttrValue
        }, null, 2));
        reliablySetAttribute(node, name, newAttrValue);
        scope.oldVal = newVal;
    }
    function reliablySetAttribute(node, name, value) {
        if (name == "class") {
            value = formatClassListValue(value);
        }
        try {
            node.setAttribute(name, value);
        }
        catch (e) {
            DEBUG && console.warn(e);
        }
        try {
            node[name] = value == undefined ? true : value;
        }
        catch (e) {
            DEBUG && console.warn(e);
        }
    }
    function getType(val) {
        const type = types_js_1.default.check(types_js_1.default `Function`, val) ? 'function' :
            types_js_1.default.check(types_js_1.default `Handlers`, val) ? 'handlers' :
                types_js_1.default.check(types_js_1.default `BrutalObject`, val) ? 'brutalobject' :
                    types_js_1.default.check(types_js_1.default `MarkupObject`, val) ? 'markupobject' :
                        types_js_1.default.check(types_js_1.default `MarkupAttrObject`, val) ? 'markupattrobject' :
                            types_js_1.default.check(types_js_1.default `BrutalArray`, val) ? 'brutalarray' :
                                types_js_1.default.check(types_js_1.default `FuncArray`, val) ? 'funcarray' :
                                    'default';
        return type;
    }
    function summonPlaceholder(sibling) {
        let ph = [...sibling.parentNode.childNodes].find(node => node.nodeType == Node.COMMENT_NODE && node.nodeValue == 'brutal-placeholder');
        if (!ph) {
            ph = toDOM(`<!--brutal-placeholder-->`).firstChild;
        }
        return ph;
    }
    // cache helpers
    // FIXME: function needs refactor
    function isCached(cacheKey, v, instanceKey) {
        let firstCall;
        let cached = cache[cacheKey];
        if (cached == undefined) {
            cached = cache[cacheKey] = {};
            if (instanceKey) {
                cached.instances = {};
                cached = cached.instances[instanceKey] = {};
            }
            firstCall = true;
        }
        else {
            if (instanceKey) {
                if (!cached.instances) {
                    cached.instances = {};
                    firstCall = true;
                }
                else {
                    cached = cached.instances[instanceKey];
                    if (!cached) {
                        firstCall = true;
                    }
                    else {
                        firstCall = false;
                    }
                }
            }
            else {
                firstCall = false;
            }
        }
        return { cached, firstCall };
    }
    // Markup helpers
    // Returns an object that Brutal treats as markup,
    // even tho it is NOT a Brutal Object (defined with R/X/$)
    // And even tho it is in the location of a template value replacement
    // Which would normally be the treated as String
    function markup(str) {
        str = types_js_1.default.check(types_js_1.default `None`, str) ? '' : str;
        const frag = toDOM(str);
        const retVal = {
            type: 'MarkupObject',
            code: common_js_2.CODE,
            nodes: [...frag.childNodes],
            externals: []
        };
        return retVal;
    }
    // Returns an object that Brutal treats, again, as markup
    // But this time markup that is OKAY to have within a quoted attribute
    function attrmarkup(str) {
        str = types_js_1.default.check(types_js_1.default `None`, str) ? '' : str;
        str = str.replace(/"/g, '&quot;');
        const retVal = {
            type: 'MarkupAttrObject',
            code: common_js_2.CODE,
            str
        };
        return retVal;
    }
    function guardEmptyHandlers(val) {
        if (Array.isArray(val)) {
            if (val.length == 0) {
                return [NULLFUNC];
            }
            return val;
        }
        else {
            if (types_js_1.default.check(types_js_1.default `None`, val)) {
                return NULLFUNC;
            }
        }
    }
    // other helpers
    function formatClassListValue(value) {
        value = value.trim();
        value = value.replace(/\s+/g, ' ');
        return value;
    }
    function replaceValWithKeyAndOmitInstanceKey(vmap) {
        return (val, vi) => {
            // omit instance key
            if (types_js_1.default.check(types_js_1.default `Key`, val)) {
                return '';
            }
            const key = ('key' + Math.random()).replace('.', '').padEnd(KEYLEN, '0').slice(0, KEYLEN);
            let k = key;
            if (types_js_1.default.check(types_js_1.default `BrutalObject`, val) || types_js_1.default.check(types_js_1.default `MarkupObject`, val)) {
                k = `<!--${k}-->`;
            }
            vmap[key.trim()] = { vi, val, replacers: [] };
            return k;
        };
    }
    function toDOM(str) {
        const templateEl = (new DOMParser).parseFromString(`<template>${str}</template>`, "text/html").head.firstElementChild;
        let f;
        if (templateEl instanceof HTMLTemplateElement) {
            f = templateEl.content;
            f.normalize();
            return f;
        }
        else {
            throw new TypeError(`Could not find template element after parsing string to DOM:\n=START=\n${str}\n=END=`);
        }
    }
    function guardAndTransformVal(v) {
        const isFunc = types_js_1.default.check(types_js_1.default `Function`, v);
        const isUnset = types_js_1.default.check(types_js_1.default `None`, v);
        const isObject = types_js_1.default.check(types_js_1.default `Object`, v);
        const isBrutalArray = types_js_1.default.check(types_js_1.default `BrutalArray`, v);
        const isFuncArray = types_js_1.default.check(types_js_1.default `FuncArray`, v);
        const isMarkupObject = types_js_1.default.check(types_js_1.default `MarkupObject`, v);
        const isMarkupAttrObject = types_js_1.default.check(types_js_1.default `MarkupAttrObject`, v);
        const isBrutal = types_js_1.default.check(types_js_1.default `BrutalObject`, v);
        const isForgery = types_js_1.default.check(types_js_1.default `BrutalLikeObject`, v) && !isBrutal;
        if (isFunc)
            return v;
        if (isBrutal)
            return v;
        if (isKey(v))
            return v;
        if (isHandlers(v))
            return v;
        if (isBrutalArray)
            return join(v);
        if (isFuncArray)
            return v;
        if (isMarkupObject)
            return v;
        if (isMarkupAttrObject)
            return v;
        if (isUnset)
            die({ error: UNSET() });
        if (isForgery)
            die({ error: XSS() });
        if (isObject)
            die({ error: OBJ() });
        return v + '';
    }
    function join(os) {
        const externals = [];
        const bigNodes = [];
        const v = [];
        const oldVals = [];
        os.forEach(o => {
            //v.push(...o.v); 
            //oldVals.push(...o.oldVals);
            externals.push(...o.externals);
            bigNodes.push(...o.nodes);
        });
        DEBUG && console.log({ oldVals, v });
        const retVal = { v, code: common_js_2.CODE, oldVals, nodes: bigNodes, to, update, externals };
        return retVal;
    }
    function nodesToStr(nodes) {
        const frag = document.createDocumentFragment();
        nodes.forEach(n => frag.appendChild(n.cloneNode(true)));
        const container = document.createElement('body');
        container.appendChild(frag);
        return container.innerHTML;
    }
    function diffNodes(last, next) {
        last = new Set(last);
        next = new Set(next);
        return new Set([...last].filter(n => !next.has(n)));
    }
    function update(newVals) {
        const updateable = this.v.filter(({ vi }) => didChange(newVals[vi], this.oldVals[vi]));
        DEBUG && console.log({ updateable, oldVals: this.oldVals, newVals });
        updateable.forEach(({ vi, replacers }) => replacers.forEach(f => f(newVals[vi])));
        this.oldVals = Array.from(newVals);
    }
    function didChange(oldVal, newVal) {
        DEBUG && console.log({ oldVal, newVal });
        const [oldType, newType] = [oldVal, newVal].map(getType);
        let ret;
        if (oldType != newType) {
            ret = true;
        }
        else {
            switch (oldType) {
                case "brutalobject":
                    // the brutal object is returned by a view function
                    // which has already called its updaters and checked its slot values
                    // to determine and show changes
                    // except in the case of a list of nodes
                    ret = true;
                    break;
                /* eslint-disable no-fallthrough */
                case "funcarray":
                case "function":
                    // hard to equate even if same str value as scope could be diff
                    ret = true;
                    break;
                case "brutalarray":
                    // need to do array dif so don't do here
                    ret = true;
                    break;
                case "markupattrobject":
                case "markupobject":
                    // need to check multiple things
                    ret = true;
                    break;
                default:
                    ret = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                    break;
                /* eslint-enable no-fallthrough */
            }
        }
        DEBUG && console.log({ ret });
        return ret;
    }
    // reporting and error helpers 
    function die(msg, err) {
        if (DEBUG && err)
            console.warn(err);
        msg.stack = ((DEBUG && err) || new Error()).stack.split(/\s*\n\s*/g);
        throw JSON.stringify(msg, null, 2);
    }
    function s(msg) {
        if (DEBUG) {
            console.log(JSON.stringify(msg, showNodes, 2));
            console.info('.');
        }
    }
    function showNodes(k, v) {
        let out = v;
        if (types_js_1.default.check(types_js_1.default `>Node`, v)) {
            out = `<${v.nodeName.toLowerCase()} ${!v.attributes ? '' : [...v.attributes].map(({ name, value }) => `${name}='${value}'`).join(' ')}>${v.nodeValue || (v.children && v.children.length <= 1 ? v.innerText : '')}`;
        }
        else if (typeof v === "function") {
            return `${v.name || 'anon'}() { ... }`;
        }
        return out;
    }
    return {
        setters: [
            function (common_js_2_1) {
                common_js_2 = common_js_2_1;
            },
            function (types_js_1_1) {
                types_js_1 = types_js_1_1;
            }
        ],
        execute: function () {
            // backwards compatible alias
            skip = markup;
            attrskip = attrmarkup;
            // constants
            DEBUG = false;
            NULLFUNC = () => void 0;
            /* eslint-disable no-useless-escape */
            KEYMATCH = /(?:<!\-\-)?(key\d+)(?:\-\->)?/gm;
            /* eslint-enable no-useless-escape */
            ATTRMATCH = /\w+=/;
            KEYLEN = 20;
            XSS = () => `Possible XSS / object forgery attack detected. ` +
                `Object code could not be verified.`;
            OBJ = () => `Object values not allowed here.`;
            UNSET = () => `Unset values not allowed here.`;
            INSERT = () => `Error inserting template into DOM. ` +
                `Position must be one of: ` +
                `replace, beforebegin, afterbegin, beforeend, innerhtml, afterend`;
            NOTFOUND = loc => `Error inserting template into DOM. ` +
                `Location ${loc} was not found in the document.`;
            MOVE = new class {
                beforeend(frag, elem) { elem.appendChild(frag); }
                beforebegin(frag, elem) { elem.parentNode.insertBefore(frag, elem); }
                afterend(frag, elem) { elem.parentNode.insertBefore(frag, elem.nextSibling); }
                replace(frag, elem) { elem.parentNode.replaceChild(frag, elem); }
                afterbegin(frag, elem) { elem.insertBefore(frag, elem.firstChild); }
                innerhtml(frag, elem) { elem.innerHTML = ''; elem.appendChild(frag); }
            };
            // logging
            self.onerror = (...v) => (console.log(v, v[0] + '', v[4] && v[4].message, v[4] && v[4].stack), true);
            // type functions
            isKey = v => types_js_1.default.check(types_js_1.default `Key`, v);
            isHandlers = v => types_js_1.default.check(types_js_1.default `Handlers`, v);
            // cache 
            cache = {};
            // deux
            exports_4("d", d = R);
            exports_4("e", e = d);
            exports_4("u", u = X);
            exports_4("x", x = u);
            // main exports 
            Object.assign(R, { s, attrskip, skip, attrmarkup, markup, guardEmptyHandlers, die });
            if (DEBUG) {
                Object.assign(self, { d, u, T: types_js_1.default });
            }
        }
    };
});
