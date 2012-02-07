/**
 * This file contains source code from the following:
 *
 * es5-shim
 * Copyright 2009, 2010 Kristopher Michael Kowal
 * MIT License
 * <https://github.com/kriskowal/es5-shim>
 */

(function(global){
	var cfg = require.config,
		is = require.is,
		each = require.is,
		Ti = {
			_5: {}
		},
		doc = document,
		body = doc.body,
		undef,
		odp = Object.defineProperty,
		ready = require("Ti/_/ready"),
		createUUID = require("Ti/_").uuid,
		sessionId,
		analyticsStorageName = "ti:analyticsEvents",
		localeData = {},
		analyticsEventSeq = 1,
		analyticsLastSent = null;

	// Object.defineProperty() shim
	if (!odp || !(function (obj) {
			try {
				odp(obj, "x", {});
				return obj.hasOwnProperty("x");
			} catch (e) { }
		}({}))) {
		// add support for Object.defineProperty() thanks to es5-shim
		Object.defineProperty = function defineProperty(obj, prop, desc) {
			if (!obj || (!is(obj, "Object") && !is(obj, "Function") && !is(obj, "Window"))) {
				throw new TypeError("Object.defineProperty called on non-object: " + obj);
			}
			desc = desc || {};
			if (!desc || (!is(desc, "Object") && !is(desc, "Function"))) {
				throw new TypeError("Property description must be an object: " + desc);
			}
	
			if (odp) {
				try {
					return odp.call(Object, obj, prop, desc);
				} catch (e) { }
			}
	
			var op = Object.prototype,
				h = function (o, p) {
					return o.hasOwnProperty(p);
				},
				a = h(op, "__defineGetter__"),
				p = obj.__proto__;
	
			if (h(desc, "value")) {
				if (a && (obj.__lookupGetter__(prop) || obj.__lookupSetter__(prop))) {
					obj.__proto__ = op;
					delete obj[prop];
					obj[prop] = desc.value;
					obj.__proto__ = p;
				} else {
					obj[prop] = desc.value;
				}
			} else {
				if (!a) {
					throw new TypeError("Getters and setters can not be defined on this javascript engine");
				}
				if (h(desc, "get")) {
					defineGetter(obj, prop, desc.get);
				}
				if (h(desc, "set")) {
					defineSetter(obj, prop, desc.set);
				} else {
					obj[prop] = null;
				}
			}
		};
	}

	Object.defineProperty(global, "Ti", { value: Ti, writable: false });
	Object.defineProperty(global, "Titanium", { value: Ti, writable: false });

	// console.*() shim	
	console === undef && (console = {});

	// make sure "log" is always at the end
	each(["debug", "info", "warn", "error", "log"], function (c) {
		console[c] || (console[c] = ("log" in console)
			?	function () {
					var a = Array.apply({}, arguments);
					a.unshift(c + ":");
					console.log(a.join(" "));
				}
			:	function () {}
		);
	});

	// JSON.parse() and JSON.stringify() shim
	if (JSON === undef || JSON.stringify({a:0}, function(k,v){return v||1;}) !== '{"a":1}') {
		function escapeString(s){
			return ('"' + s.replace(/(["\\])/g, '\\$1') + '"').
				replace(/[\f]/g, "\\f").replace(/[\b]/g, "\\b").replace(/[\n]/g, "\\n").
				replace(/[\t]/g, "\\t").replace(/[\r]/g, "\\r");
		}
	
		JSON.parse = function (s) {
			return eval('(' + s + ')');
		};
	
		JSON.stringify = function (value, replacer, space) {
			if (is(replacer, "String")) {
				space = replacer;
				replacer = null;
			}
	
			function stringify(it, indent, key) {
				var val,
					len,
					objtype = typeof it,
					nextIndent = space ? (indent + space) : "",
					sep = space ? " " : "",
					newLine = space ? "\n" : "",
					ar = [];
	
				if (replacer) {
					it = replacer(key, it);
				}
				if (objtype === "number") {
					return isFinite(it) ? it + "" : "null";
				}
				if (is(objtype, "Boolean")) {
					return it + "";
				}
				if (it === null) {
					return "null";
				}
				if (is(it, "String")) {
					return escapeString(it);
				}
				if (objtype === "function" || objtype === "undefined") {
					return undef;
				}
	
				// short-circuit for objects that support "json" serialization
				// if they return "self" then just pass-through...
				if (is(it.toJSON, "Function")) {
					return stringify(it.toJSON(key), indent, key);
				}
				if (it instanceof Date) {
					return '"{FullYear}-{Month+}-{Date}T{Hours}:{Minutes}:{Seconds}Z"'.replace(/\{(\w+)(\+)?\}/g, function(t, prop, plus){
						var num = it["getUTC" + prop]() + (plus ? 1 : 0);
						return num < 10 ? "0" + num : num;
					});
				}
				if (it.valueOf() !== it) {
					return stringify(it.valueOf(), indent, key);
				}
	
				// array code path
				if (it instanceof Array) {
					for(key = 0, len = it.length; key < len; key++){
						var obj = it[key];
						val = stringify(obj, nextIndent, key);
						if (!is(val, "String")) {
							val = "null";
						}
						ar.push(newLine + nextIndent + val);
					}
					return "[" + ar.join(",") + newLine + indent + "]";
				}
	
				// generic object code path
				for (key in it) {
					var keyStr;
					if (is(key, "Number")) {
						keyStr = '"' + key + '"';
					} else if (is(key, "String")) {
						keyStr = escapeString(key);
					} else {
						continue;
					}
					val = stringify(it[key], nextIndent, key);
					if (!is(val, "String")) {
						// skip non-serializable values
						continue;
					}
					// At this point, the most non-IE browsers don't get in this branch 
					// (they have native JSON), so push is definitely the way to
					ar.push(newLine + nextIndent + keyStr + ":" + sep + val);
				}
				return "{" + ar.join(",") + newLine + indent + "}"; // String
			}
	
			return stringify(value, "", "");
		};
	}

	// print the Titanium version *after* the console shim
	console.info("[INFO] Appcelerator Titanium " + cfg.ti.version + " Mobile Web");

	require.has.add("devmode", cfg.deployType === "development");
	require.has.add("opera", typeof opera === "undefined" || opera.toString() != "[object Opera]");

	// make sure we have some vendor prefixes defined
	cfg.vendorPrefixes || (cfg.vendorPrefixes = ["", "Moz", "Webkit", "O", "ms"]);

	// expose JSON functions to Ti namespace
	Ti.parse = JSON.parse;
	Ti.stringify = JSON.stringify;

	require.on(global, "beforeunload", function() {
		Ti.App.fireEvent("close");
		Ti._5.addAnalyticsEvent("ti.end", "ti.end");
	});

	Ti._5.prop = function(obj, property, value, descriptor) {
		if (require.is(property, "Object")) {
			for (var i in property) {
				Ti._5.prop(obj, i, property[i]);
			}
		} else {
			var skipSet,
				capitalizedName = require("Ti/_/string").capitalize(property);

			// if we only have 3 args, so need to check if it's a default value or a descriptor
			if (arguments.length === 3 && require.is(value, "Object") && (value.get || value.set)) {
				descriptor = value;
				// we don't have a default value, so skip the set
				skipSet = 1;
			}

			// if we have a descriptor, then defineProperty
			if (descriptor) {
				if ("value" in descriptor) {
					skipSet = 2;
					if (descriptor.get || descriptor.set) {
						// we have a value, but since there's a custom setter/getter, we can't have a value
						value = descriptor.value;
						delete descriptor.value;
						value !== undef && (skipSet = 0);
					} else {
						descriptor.writable = true;
					}
				}
				descriptor.configurable = true;
				descriptor.enumerable = true;
				Object.defineProperty(obj, property, descriptor);
			}

			// create the get/set functions
			obj["get" + capitalizedName] = function(){ return obj[property]; };
			(skipSet | 0) < 2 && (obj["set" + capitalizedName] = function(val){ return obj[property] = val; });

			// if there's no default value or it's already been set with defineProperty(), then we skip setting it
			skipSet || (obj[property] = value);
		}
	};

	Ti._5.propReadOnly = function(obj, property, value) {
		var i;
		if (require.is(property, "Object")) {
			for (i in property) {
				Ti._5.propReadOnly(obj, i, property[i]);
			}
		} else {
			Ti._5.prop(obj, property, undef, require.is(value, "Function") ? { get: value, value: undef } : { value: value });
		}
	};

	Ti._5.createClass = function(className, value){
		var i,
			classes = className.split("."),
			klass,
			parent = global;
		for (i = 0; i < classes.length; i++) {
			klass = classes[i];
			parent[klass] === undef && (parent[klass] = i == classes.length - 1 && value !== undef ? value : new Object());
			parent = parent[klass];
		}
		return parent;
	};

	sessionId = "sessionStorage" in global && sessionStorage.getItem("mobileweb_sessionId");
	sessionId || sessionStorage.setItem("mobileweb_sessionId", sessionId = createUUID());

	Ti._5.addAnalyticsEvent = function(eventType, eventEvent, data, isUrgent){
		if (!cfg.analytics) {
			return;
		}

		// store event
		var storage = localStorage.getItem(analyticsStorageName);
			now = new Date(),
			tz = now.getTimezoneOffset(),
			atz = Math.abs(tz),
			m = now.getMonth() + 1,
			d = now.getDate(),
			ts = now.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (d < 10 ? "0" + d : d) + "T" + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds() + "." + now.getMilliseconds() + (tz < 0 ? "-" : "+") + (atz < 100 ? "00" : (atz < 1000 ? "0" : "")) + atz,
			formatZeros = function(v, n){
				var d = (v+'').length;
				return (d < n ? (new Array(++n - d)).join("0") : "") + v;
			};

		storage = storage ? JSON.parse(storage) : [];
		storage.push({
			eventId: createUUID(),
			eventType: eventType,
			eventEvent: eventEvent,
			eventTimestamp: ts,
			eventPayload: data
		});
		localStorage.setItem(analyticsStorageName, JSON.stringify(storage));
		Ti._5.sendAnalytics(isUrgent);
	};

	// collect and send Ti.Analytics notifications
	Ti._5.sendAnalytics = function(isUrgent){
		if (!cfg.analytics) {
			return;
		}

		var i,
			evt,
			storage = JSON.parse(localStorage.getItem(analyticsStorageName)),
			now = (new Date()).getTime(),
			jsonStrs = [],
			ids = [],
			iframe,
			form,
			hidden,
			rand = Math.floor(Math.random() * 1e6),
			iframeName = "analytics" + rand,
			callback = "mobileweb_jsonp" + rand;

		if (storage === null || (!isUrgent && analyticsLastSent !== null && now - analyticsLastSent < 300000 /* 5 minutes */)) {
			return;
		}

		analyticsLastSent = now;

		for (i = 0; i < storage.length; i++) {
			evt = storage[i];
			ids.push(evt.eventId);
			jsonStrs.push(JSON.stringify({
				seq: analyticsEventSeq++,
				ver: "2",
				id: evt.eventId,
				type: evt.eventType,
				event: evt.eventEvent,
				ts: evt.eventTimestamp,
				mid: Ti.Platform.id,
				sid: sessionId,
				aguid: cfg.guid,
				data: require.is(evt.eventPayload, "object") ? JSON.stringify(evt.eventPayload) : evt.eventPayload
			}));
		}

		function onIframeLoaded() {
			form.parentNode.removeChild(form);
			iframe.parentNode.removeChild(iframe);
		}

		iframe = doc.createElement("iframe");
		iframe.style.display = "none";
		iframe.id = iframe.name = iframeName;

		form = doc.createElement("form");
		form.style.display = "none";
		form.target = iframeName;
		form.method = "POST";
		form.action = "https://api.appcelerator.net/p/v2/mobile-track?callback=" + callback;

		hidden = doc.createElement("input");
		hidden.type = "hidden";
		hidden.name = "content";
		hidden.value = "[" + jsonStrs.join(",") + "]";

		body.appendChild(iframe);
		body.appendChild(form);
		form.appendChild(hidden);

		global[callback] = function(response){
			if(response && response.success){
				// remove sent events on successful sent
				var j, k, found,
					storage = localStorage.getItem(analyticsStorageName),
					ev,
					evs = [];

				for (j = 0; j < storage.length; j++) {
					ev = storage[j];
					found = 0;
					for (k = 0; k < ids.length; k++) {
						if (ev.eventId == ids[k]) {
							found = 1;
							ids.splice(k, 1);
							break;
						}
					}
					found || evs.push(ev);
				}

				localStorage.setItem(analyticsStorageName, JSON.stringify(evs));
				
			}
		};

		// need to delay attaching of iframe events so they aren't prematurely called
		setTimeout(function() {
			iframe.onload = onIframeLoaded;
			iframe.onerror = onIframeLoaded;
			form.submit();
		}, 25);
	};

	Ti._5.extend = function(dest, source){
		for (var key in source) {
			dest[key] = source[key];
		}
		return dest;
	};

	Ti._5.setLocaleData = function(obj){
		localeData = obj;
	};

	Ti._5.getLocaleData = function(){
		return localeData;
	};

	// Get browser window sizes
	Ti._5.getWindowSizes = function() {
		var n,
			docElem = doc.documentElement;
		if (body.offsetWidth) {
			n = {
				width: body.offsetWidth|0,
				height: body.offsetHeight|0
			};
		} else if (doc.compatMode === "CSS1Compat" && docElem && docElem.offsetWidth) {
			n = {
				width: docElem.offsetWidth,
				height: docElem.offsetHeight
			};
		} else if (global.innerWidth && global.innerHeight) {
			n = {
				width: global.innerWidth,
				height: global.innerHeight
			};
		}
		return n;
	};

	ready(function() {
		body.style.margin = 0;
		body.style.padding = 0;

		if (cfg.analytics) {
			// enroll event
			if (localStorage.getItem("mobileweb_enrollSent") === null) {
				// setup enroll event
				Ti._5.addAnalyticsEvent('ti.enroll', 'ti.enroll', {
					mac_addr: null,
					oscpu: null,
					app_name: cfg.appName,
					platform: Ti.Platform.name,
					app_id: cfg.appId,
					ostype: Ti.Platform.osname,
					osarch: Ti.Platform.architecture,
					model: Ti.Platform.model,
					deploytype: cfg.deployType
				});
				localStorage.setItem("mobileweb_enrollSent", true)
			}

			// app start event
			Ti._5.addAnalyticsEvent('ti.start', 'ti.start', {
				tz: (new Date()).getTimezoneOffset(),
				deploytype: cfg.deployType,
				os: Ti.Platform.osname,
				osver: Ti.Platform.ostype,
				version: cfg.tiVersion,
				un: null,
				app_version: cfg.appVersion,
				nettype: null
			});

			// try to sent previously sent analytics events on app load
			Ti._5.sendAnalytics();
		}

		// load app.js when ti and dom is ready
		ready(function() {
			require([cfg.main || "app.js"]);
		});
	});

}(window));
