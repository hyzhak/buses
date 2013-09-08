/*! Hammer.JS - v1.0.5 - 2013-04-07
 * http://eightmedia.github.com/hammer.js
 *
 * Copyright (c) 2013 Jorik Tangelder <j.tangelder@gmail.com>;
 * Licensed under the MIT license */

(function(window, undefined) {
    'use strict';

/**
 * Hammer
 * use this to create instances
 * @param   {HTMLElement}   element
 * @param   {Object}        options
 * @returns {Hammer.Instance}
 * @constructor
 */
var Hammer = function(element, options) {
    return new Hammer.Instance(element, options || {});
};

// default settings
Hammer.defaults = {
    // add styles and attributes to the element to prevent the browser from doing
    // its native behavior. this doesnt prevent the scrolling, but cancels
    // the contextmenu, tap highlighting etc
    // set to false to disable this
    stop_browser_behavior: {
		// this also triggers onselectstart=false for IE
        userSelect: 'none',
		// this makes the element blocking in IE10 >, you could experiment with the value
		// see for more options this issue; https://github.com/EightMedia/hammer.js/issues/241
        touchAction: 'none',
		touchCallout: 'none',
        contentZooming: 'none',
        userDrag: 'none',
        tapHighlightColor: 'rgba(0,0,0,0)'
    }

    // more settings are defined per gesture at gestures.js
};

// detect touchevents
Hammer.HAS_POINTEREVENTS = navigator.pointerEnabled || navigator.msPointerEnabled;
Hammer.HAS_TOUCHEVENTS = ('ontouchstart' in window);

// dont use mouseevents on mobile devices
Hammer.MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android/i;
Hammer.NO_MOUSEEVENTS = Hammer.HAS_TOUCHEVENTS && navigator.userAgent.match(Hammer.MOBILE_REGEX);

// eventtypes per touchevent (start, move, end)
// are filled by Hammer.event.determineEventTypes on setup
Hammer.EVENT_TYPES = {};

// direction defines
Hammer.DIRECTION_DOWN = 'down';
Hammer.DIRECTION_LEFT = 'left';
Hammer.DIRECTION_UP = 'up';
Hammer.DIRECTION_RIGHT = 'right';

// pointer type
Hammer.POINTER_MOUSE = 'mouse';
Hammer.POINTER_TOUCH = 'touch';
Hammer.POINTER_PEN = 'pen';

// touch event defines
Hammer.EVENT_START = 'start';
Hammer.EVENT_MOVE = 'move';
Hammer.EVENT_END = 'end';

// hammer document where the base events are added at
Hammer.DOCUMENT = document;

// plugins namespace
Hammer.plugins = {};

// if the window events are set...
Hammer.READY = false;

/**
 * setup events to detect gestures on the document
 */
function setup() {
    if(Hammer.READY) {
        return;
    }

    // find what eventtypes we add listeners to
    Hammer.event.determineEventTypes();

    // Register all gestures inside Hammer.gestures
    for(var name in Hammer.gestures) {
        if(Hammer.gestures.hasOwnProperty(name)) {
            Hammer.detection.register(Hammer.gestures[name]);
        }
    }

    // Add touch events on the document
    Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_MOVE, Hammer.detection.detect);
    Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_END, Hammer.detection.detect);

    // Hammer is ready...!
    Hammer.READY = true;
}

/**
 * create new hammer instance
 * all methods should return the instance itself, so it is chainable.
 * @param   {HTMLElement}       element
 * @param   {Object}            [options={}]
 * @returns {Hammer.Instance}
 * @constructor
 */
Hammer.Instance = function(element, options) {
    var self = this;

    // setup HammerJS window events and register all gestures
    // this also sets up the default options
    setup();

    this.element = element;

    // start/stop detection option
    this.enabled = true;

    // merge options
    this.options = Hammer.utils.extend(
        Hammer.utils.extend({}, Hammer.defaults),
        options || {});

    // add some css to the element to prevent the browser from doing its native behavoir
    if(this.options.stop_browser_behavior) {
        Hammer.utils.stopDefaultBrowserBehavior(this.element, this.options.stop_browser_behavior);
    }

    // start detection on touchstart
    Hammer.event.onTouch(element, Hammer.EVENT_START, function(ev) {
        if(self.enabled) {
            Hammer.detection.startDetect(self, ev);
        }
    });

    // return instance
    return this;
};


Hammer.Instance.prototype = {
    /**
     * bind events to the instance
     * @param   {String}      gesture
     * @param   {Function}    handler
     * @returns {Hammer.Instance}
     */
    on: function onEvent(gesture, handler){
        var gestures = gesture.split(' ');
        for(var t=0; t<gestures.length; t++) {
            this.element.addEventListener(gestures[t], handler, false);
        }
        return this;
    },


    /**
     * unbind events to the instance
     * @param   {String}      gesture
     * @param   {Function}    handler
     * @returns {Hammer.Instance}
     */
    off: function offEvent(gesture, handler){
        var gestures = gesture.split(' ');
        for(var t=0; t<gestures.length; t++) {
            this.element.removeEventListener(gestures[t], handler, false);
        }
        return this;
    },


    /**
     * trigger gesture event
     * @param   {String}      gesture
     * @param   {Object}      eventData
     * @returns {Hammer.Instance}
     */
    trigger: function triggerEvent(gesture, eventData){
        // create DOM event
        var event = Hammer.DOCUMENT.createEvent('Event');
		event.initEvent(gesture, true, true);
		event.gesture = eventData;

        // trigger on the target if it is in the instance element,
        // this is for event delegation tricks
        var element = this.element;
        if(Hammer.utils.hasParent(eventData.target, element)) {
            element = eventData.target;
        }

        element.dispatchEvent(event);
        return this;
    },


    /**
     * enable of disable hammer.js detection
     * @param   {Boolean}   state
     * @returns {Hammer.Instance}
     */
    enable: function enable(state) {
        this.enabled = state;
        return this;
    }
};

/**
 * this holds the last move event,
 * used to fix empty touchend issue
 * see the onTouch event for an explanation
 * @type {Object}
 */
var last_move_event = null;


/**
 * when the mouse is hold down, this is true
 * @type {Boolean}
 */
var enable_detect = false;


/**
 * when touch events have been fired, this is true
 * @type {Boolean}
 */
var touch_triggered = false;


Hammer.event = {
    /**
     * simple addEventListener
     * @param   {HTMLElement}   element
     * @param   {String}        type
     * @param   {Function}      handler
     */
    bindDom: function(element, type, handler) {
        var types = type.split(' ');
        for(var t=0; t<types.length; t++) {
            element.addEventListener(types[t], handler, false);
        }
    },


    /**
     * touch events with mouse fallback
     * @param   {HTMLElement}   element
     * @param   {String}        eventType        like Hammer.EVENT_MOVE
     * @param   {Function}      handler
     */
    onTouch: function onTouch(element, eventType, handler) {
		var self = this;

        this.bindDom(element, Hammer.EVENT_TYPES[eventType], function bindDomOnTouch(ev) {
            var sourceEventType = ev.type.toLowerCase();

            // onmouseup, but when touchend has been fired we do nothing.
            // this is for touchdevices which also fire a mouseup on touchend
            if(sourceEventType.match(/mouse/) && touch_triggered) {
                return;
            }

            // mousebutton must be down or a touch event
            else if( sourceEventType.match(/touch/) ||   // touch events are always on screen
                sourceEventType.match(/pointerdown/) || // pointerevents touch
                (sourceEventType.match(/mouse/) && ev.which === 1)   // mouse is pressed
            ){
                enable_detect = true;
            }

            // we are in a touch event, set the touch triggered bool to true,
            // this for the conflicts that may occur on ios and android
            if(sourceEventType.match(/touch|pointer/)) {
                touch_triggered = true;
            }

            // count the total touches on the screen
            var count_touches = 0;

            // when touch has been triggered in this detection session
            // and we are now handling a mouse event, we stop that to prevent conflicts
            if(enable_detect) {
                // update pointerevent
                if(Hammer.HAS_POINTEREVENTS && eventType != Hammer.EVENT_END) {
                    count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
                }
                // touch
                else if(sourceEventType.match(/touch/)) {
                    count_touches = ev.touches.length;
                }
                // mouse
                else if(!touch_triggered) {
                    count_touches = sourceEventType.match(/up/) ? 0 : 1;
                }

                // if we are in a end event, but when we remove one touch and
                // we still have enough, set eventType to move
                if(count_touches > 0 && eventType == Hammer.EVENT_END) {
                    eventType = Hammer.EVENT_MOVE;
                }
                // no touches, force the end event
                else if(!count_touches) {
                    eventType = Hammer.EVENT_END;
                }

                // because touchend has no touches, and we often want to use these in our gestures,
                // we send the last move event as our eventData in touchend
                if(!count_touches && last_move_event !== null) {
                    ev = last_move_event;
                }
                // store the last move event
                else {
                    last_move_event = ev;
                }

                // trigger the handler
                handler.call(Hammer.detection, self.collectEventData(element, eventType, ev));

                // remove pointerevent from list
                if(Hammer.HAS_POINTEREVENTS && eventType == Hammer.EVENT_END) {
                    count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
                }
            }

            //debug(sourceEventType +" "+ eventType);

            // on the end we reset everything
            if(!count_touches) {
                last_move_event = null;
                enable_detect = false;
                touch_triggered = false;
                Hammer.PointerEvent.reset();
            }
        });
    },


    /**
     * we have different events for each device/browser
     * determine what we need and set them in the Hammer.EVENT_TYPES constant
     */
    determineEventTypes: function determineEventTypes() {
        // determine the eventtype we want to set
        var types;

        // pointerEvents magic
        if(Hammer.HAS_POINTEREVENTS) {
            types = Hammer.PointerEvent.getEvents();
        }
        // on Android, iOS, blackberry, windows mobile we dont want any mouseevents
        else if(Hammer.NO_MOUSEEVENTS) {
            types = [
                'touchstart',
                'touchmove',
                'touchend touchcancel'];
        }
        // for non pointer events browsers and mixed browsers,
        // like chrome on windows8 touch laptop
        else {
            types = [
                'touchstart mousedown',
                'touchmove mousemove',
                'touchend touchcancel mouseup'];
        }

        Hammer.EVENT_TYPES[Hammer.EVENT_START]  = types[0];
        Hammer.EVENT_TYPES[Hammer.EVENT_MOVE]   = types[1];
        Hammer.EVENT_TYPES[Hammer.EVENT_END]    = types[2];
    },


    /**
     * create touchlist depending on the event
     * @param   {Object}    ev
     * @param   {String}    eventType   used by the fakemultitouch plugin
     */
    getTouchList: function getTouchList(ev/*, eventType*/) {
        // get the fake pointerEvent touchlist
        if(Hammer.HAS_POINTEREVENTS) {
            return Hammer.PointerEvent.getTouchList();
        }
        // get the touchlist
        else if(ev.touches) {
            return ev.touches;
        }
        // make fake touchlist from mouse position
        else {
            return [{
                identifier: 1,
                pageX: ev.pageX,
                pageY: ev.pageY,
                target: ev.target
            }];
        }
    },


    /**
     * collect event data for Hammer js
     * @param   {HTMLElement}   element
     * @param   {String}        eventType        like Hammer.EVENT_MOVE
     * @param   {Object}        eventData
     */
    collectEventData: function collectEventData(element, eventType, ev) {
        var touches = this.getTouchList(ev, eventType);

        // find out pointerType
        var pointerType = Hammer.POINTER_TOUCH;
        if(ev.type.match(/mouse/) || Hammer.PointerEvent.matchType(Hammer.POINTER_MOUSE, ev)) {
            pointerType = Hammer.POINTER_MOUSE;
        }

        return {
            center      : Hammer.utils.getCenter(touches),
            timeStamp   : new Date().getTime(),
            target      : ev.target,
            touches     : touches,
            eventType   : eventType,
            pointerType : pointerType,
            srcEvent    : ev,

            /**
             * prevent the browser default actions
             * mostly used to disable scrolling of the browser
             */
            preventDefault: function() {
                if(this.srcEvent.preventManipulation) {
                    this.srcEvent.preventManipulation();
                }

                if(this.srcEvent.preventDefault) {
                    this.srcEvent.preventDefault();
                }
            },

            /**
             * stop bubbling the event up to its parents
             */
            stopPropagation: function() {
                this.srcEvent.stopPropagation();
            },

            /**
             * immediately stop gesture detection
             * might be useful after a swipe was detected
             * @return {*}
             */
            stopDetect: function() {
                return Hammer.detection.stopDetect();
            }
        };
    }
};

Hammer.PointerEvent = {
    /**
     * holds all pointers
     * @type {Object}
     */
    pointers: {},

    /**
     * get a list of pointers
     * @returns {Array}     touchlist
     */
    getTouchList: function() {
        var self = this;
        var touchlist = [];

        // we can use forEach since pointerEvents only is in IE10
        Object.keys(self.pointers).sort().forEach(function(id) {
            touchlist.push(self.pointers[id]);
        });
        return touchlist;
    },

    /**
     * update the position of a pointer
     * @param   {String}   type             Hammer.EVENT_END
     * @param   {Object}   pointerEvent
     */
    updatePointer: function(type, pointerEvent) {
        if(type == Hammer.EVENT_END) {
            this.pointers = {};
        }
        else {
            pointerEvent.identifier = pointerEvent.pointerId;
            this.pointers[pointerEvent.pointerId] = pointerEvent;
        }

        return Object.keys(this.pointers).length;
    },

    /**
     * check if ev matches pointertype
     * @param   {String}        pointerType     Hammer.POINTER_MOUSE
     * @param   {PointerEvent}  ev
     */
    matchType: function(pointerType, ev) {
        if(!ev.pointerType) {
            return false;
        }

        var types = {};
        types[Hammer.POINTER_MOUSE] = (ev.pointerType == ev.MSPOINTER_TYPE_MOUSE || ev.pointerType == Hammer.POINTER_MOUSE);
        types[Hammer.POINTER_TOUCH] = (ev.pointerType == ev.MSPOINTER_TYPE_TOUCH || ev.pointerType == Hammer.POINTER_TOUCH);
        types[Hammer.POINTER_PEN] = (ev.pointerType == ev.MSPOINTER_TYPE_PEN || ev.pointerType == Hammer.POINTER_PEN);
        return types[pointerType];
    },


    /**
     * get events
     */
    getEvents: function() {
        return [
            'pointerdown MSPointerDown',
            'pointermove MSPointerMove',
            'pointerup pointercancel MSPointerUp MSPointerCancel'
        ];
    },

    /**
     * reset the list
     */
    reset: function() {
        this.pointers = {};
    }
};


Hammer.utils = {
    /**
     * extend method,
     * also used for cloning when dest is an empty object
     * @param   {Object}    dest
     * @param   {Object}    src
	 * @parm	{Boolean}	merge		do a merge
     * @returns {Object}    dest
     */
    extend: function extend(dest, src, merge) {
        for (var key in src) {
			if(dest[key] !== undefined && merge) {
				continue;
			}
            dest[key] = src[key];
        }
        return dest;
    },


    /**
     * find if a node is in the given parent
     * used for event delegation tricks
     * @param   {HTMLElement}   node
     * @param   {HTMLElement}   parent
     * @returns {boolean}       has_parent
     */
    hasParent: function(node, parent) {
        while(node){
            if(node == parent) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    },


    /**
     * get the center of all the touches
     * @param   {Array}     touches
     * @returns {Object}    center
     */
    getCenter: function getCenter(touches) {
        var valuesX = [], valuesY = [];

        for(var t= 0,len=touches.length; t<len; t++) {
            valuesX.push(touches[t].pageX);
            valuesY.push(touches[t].pageY);
        }

        return {
            pageX: ((Math.min.apply(Math, valuesX) + Math.max.apply(Math, valuesX)) / 2),
            pageY: ((Math.min.apply(Math, valuesY) + Math.max.apply(Math, valuesY)) / 2)
        };
    },


    /**
     * calculate the velocity between two points
     * @param   {Number}    delta_time
     * @param   {Number}    delta_x
     * @param   {Number}    delta_y
     * @returns {Object}    velocity
     */
    getVelocity: function getVelocity(delta_time, delta_x, delta_y) {
        return {
            x: Math.abs(delta_x / delta_time) || 0,
            y: Math.abs(delta_y / delta_time) || 0
        };
    },


    /**
     * calculate the angle between two coordinates
     * @param   {Touch}     touch1
     * @param   {Touch}     touch2
     * @returns {Number}    angle
     */
    getAngle: function getAngle(touch1, touch2) {
        var y = touch2.pageY - touch1.pageY,
            x = touch2.pageX - touch1.pageX;
        return Math.atan2(y, x) * 180 / Math.PI;
    },


    /**
     * angle to direction define
     * @param   {Touch}     touch1
     * @param   {Touch}     touch2
     * @returns {String}    direction constant, like Hammer.DIRECTION_LEFT
     */
    getDirection: function getDirection(touch1, touch2) {
        var x = Math.abs(touch1.pageX - touch2.pageX),
            y = Math.abs(touch1.pageY - touch2.pageY);

        if(x >= y) {
            return touch1.pageX - touch2.pageX > 0 ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
        }
        else {
            return touch1.pageY - touch2.pageY > 0 ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
        }
    },


    /**
     * calculate the distance between two touches
     * @param   {Touch}     touch1
     * @param   {Touch}     touch2
     * @returns {Number}    distance
     */
    getDistance: function getDistance(touch1, touch2) {
        var x = touch2.pageX - touch1.pageX,
            y = touch2.pageY - touch1.pageY;
        return Math.sqrt((x*x) + (y*y));
    },


    /**
     * calculate the scale factor between two touchLists (fingers)
     * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
     * @param   {Array}     start
     * @param   {Array}     end
     * @returns {Number}    scale
     */
    getScale: function getScale(start, end) {
        // need two fingers...
        if(start.length >= 2 && end.length >= 2) {
            return this.getDistance(end[0], end[1]) /
                this.getDistance(start[0], start[1]);
        }
        return 1;
    },


    /**
     * calculate the rotation degrees between two touchLists (fingers)
     * @param   {Array}     start
     * @param   {Array}     end
     * @returns {Number}    rotation
     */
    getRotation: function getRotation(start, end) {
        // need two fingers
        if(start.length >= 2 && end.length >= 2) {
            return this.getAngle(end[1], end[0]) -
                this.getAngle(start[1], start[0]);
        }
        return 0;
    },


    /**
     * boolean if the direction is vertical
     * @param    {String}    direction
     * @returns  {Boolean}   is_vertical
     */
    isVertical: function isVertical(direction) {
        return (direction == Hammer.DIRECTION_UP || direction == Hammer.DIRECTION_DOWN);
    },


    /**
     * stop browser default behavior with css props
     * @param   {HtmlElement}   element
     * @param   {Object}        css_props
     */
    stopDefaultBrowserBehavior: function stopDefaultBrowserBehavior(element, css_props) {
        var prop,
            vendors = ['webkit','khtml','moz','ms','o',''];

        if(!css_props || !element.style) {
            return;
        }

        // with css properties for modern browsers
        for(var i = 0; i < vendors.length; i++) {
            for(var p in css_props) {
                if(css_props.hasOwnProperty(p)) {
                    prop = p;

                    // vender prefix at the property
                    if(vendors[i]) {
                        prop = vendors[i] + prop.substring(0, 1).toUpperCase() + prop.substring(1);
                    }

                    // set the style
                    element.style[prop] = css_props[p];
                }
            }
        }

        // also the disable onselectstart
        if(css_props.userSelect == 'none') {
            element.onselectstart = function() {
                return false;
            };
        }
    }
};

Hammer.detection = {
    // contains all registred Hammer.gestures in the correct order
    gestures: [],

    // data of the current Hammer.gesture detection session
    current: null,

    // the previous Hammer.gesture session data
    // is a full clone of the previous gesture.current object
    previous: null,

    // when this becomes true, no gestures are fired
    stopped: false,


    /**
     * start Hammer.gesture detection
     * @param   {Hammer.Instance}   inst
     * @param   {Object}            eventData
     */
    startDetect: function startDetect(inst, eventData) {
        // already busy with a Hammer.gesture detection on an element
        if(this.current) {
            return;
        }

        this.stopped = false;

        this.current = {
            inst        : inst, // reference to HammerInstance we're working for
            startEvent  : Hammer.utils.extend({}, eventData), // start eventData for distances, timing etc
            lastEvent   : false, // last eventData
            name        : '' // current gesture we're in/detected, can be 'tap', 'hold' etc
        };

        this.detect(eventData);
    },


    /**
     * Hammer.gesture detection
     * @param   {Object}    eventData
     * @param   {Object}    eventData
     */
    detect: function detect(eventData) {
        if(!this.current || this.stopped) {
            return;
        }

        // extend event data with calculations about scale, distance etc
        eventData = this.extendEventData(eventData);

        // instance options
        var inst_options = this.current.inst.options;

        // call Hammer.gesture handlers
        for(var g=0,len=this.gestures.length; g<len; g++) {
            var gesture = this.gestures[g];

            // only when the instance options have enabled this gesture
            if(!this.stopped && inst_options[gesture.name] !== false) {
                // if a handler returns false, we stop with the detection
                if(gesture.handler.call(gesture, eventData, this.current.inst) === false) {
                    this.stopDetect();
                    break;
                }
            }
        }

        // store as previous event event
        if(this.current) {
            this.current.lastEvent = eventData;
        }

        // endevent, but not the last touch, so dont stop
        if(eventData.eventType == Hammer.EVENT_END && !eventData.touches.length-1) {
            this.stopDetect();
        }

        return eventData;
    },


    /**
     * clear the Hammer.gesture vars
     * this is called on endDetect, but can also be used when a final Hammer.gesture has been detected
     * to stop other Hammer.gestures from being fired
     */
    stopDetect: function stopDetect() {
        // clone current data to the store as the previous gesture
        // used for the double tap gesture, since this is an other gesture detect session
        this.previous = Hammer.utils.extend({}, this.current);

        // reset the current
        this.current = null;

        // stopped!
        this.stopped = true;
    },


    /**
     * extend eventData for Hammer.gestures
     * @param   {Object}   ev
     * @returns {Object}   ev
     */
    extendEventData: function extendEventData(ev) {
        var startEv = this.current.startEvent;

        // if the touches change, set the new touches over the startEvent touches
        // this because touchevents don't have all the touches on touchstart, or the
        // user must place his fingers at the EXACT same time on the screen, which is not realistic
        // but, sometimes it happens that both fingers are touching at the EXACT same time
        if(startEv && (ev.touches.length != startEv.touches.length || ev.touches === startEv.touches)) {
            // extend 1 level deep to get the touchlist with the touch objects
            startEv.touches = [];
            for(var i=0,len=ev.touches.length; i<len; i++) {
                startEv.touches.push(Hammer.utils.extend({}, ev.touches[i]));
            }
        }

        var delta_time = ev.timeStamp - startEv.timeStamp,
            delta_x = ev.center.pageX - startEv.center.pageX,
            delta_y = ev.center.pageY - startEv.center.pageY,
            velocity = Hammer.utils.getVelocity(delta_time, delta_x, delta_y);

        Hammer.utils.extend(ev, {
            deltaTime   : delta_time,

            deltaX      : delta_x,
            deltaY      : delta_y,

            velocityX   : velocity.x,
            velocityY   : velocity.y,

            distance    : Hammer.utils.getDistance(startEv.center, ev.center),
            angle       : Hammer.utils.getAngle(startEv.center, ev.center),
            direction   : Hammer.utils.getDirection(startEv.center, ev.center),

            scale       : Hammer.utils.getScale(startEv.touches, ev.touches),
            rotation    : Hammer.utils.getRotation(startEv.touches, ev.touches),

            startEvent  : startEv
        });

        return ev;
    },


    /**
     * register new gesture
     * @param   {Object}    gesture object, see gestures.js for documentation
     * @returns {Array}     gestures
     */
    register: function register(gesture) {
        // add an enable gesture options if there is no given
        var options = gesture.defaults || {};
        if(options[gesture.name] === undefined) {
            options[gesture.name] = true;
        }

        // extend Hammer default options with the Hammer.gesture options
        Hammer.utils.extend(Hammer.defaults, options, true);

        // set its index
        gesture.index = gesture.index || 1000;

        // add Hammer.gesture to the list
        this.gestures.push(gesture);

        // sort the list by index
        this.gestures.sort(function(a, b) {
            if (a.index < b.index) {
                return -1;
            }
            if (a.index > b.index) {
                return 1;
            }
            return 0;
        });

        return this.gestures;
    }
};


Hammer.gestures = Hammer.gestures || {};

/**
 * Custom gestures
 * ==============================
 *
 * Gesture object
 * --------------------
 * The object structure of a gesture:
 *
 * { name: 'mygesture',
 *   index: 1337,
 *   defaults: {
 *     mygesture_option: true
 *   }
 *   handler: function(type, ev, inst) {
 *     // trigger gesture event
 *     inst.trigger(this.name, ev);
 *   }
 * }

 * @param   {String}    name
 * this should be the name of the gesture, lowercase
 * it is also being used to disable/enable the gesture per instance config.
 *
 * @param   {Number}    [index=1000]
 * the index of the gesture, where it is going to be in the stack of gestures detection
 * like when you build an gesture that depends on the drag gesture, it is a good
 * idea to place it after the index of the drag gesture.
 *
 * @param   {Object}    [defaults={}]
 * the default settings of the gesture. these are added to the instance settings,
 * and can be overruled per instance. you can also add the name of the gesture,
 * but this is also added by default (and set to true).
 *
 * @param   {Function}  handler
 * this handles the gesture detection of your custom gesture and receives the
 * following arguments:
 *
 *      @param  {Object}    eventData
 *      event data containing the following properties:
 *          timeStamp   {Number}        time the event occurred
 *          target      {HTMLElement}   target element
 *          touches     {Array}         touches (fingers, pointers, mouse) on the screen
 *          pointerType {String}        kind of pointer that was used. matches Hammer.POINTER_MOUSE|TOUCH
 *          center      {Object}        center position of the touches. contains pageX and pageY
 *          deltaTime   {Number}        the total time of the touches in the screen
 *          deltaX      {Number}        the delta on x axis we haved moved
 *          deltaY      {Number}        the delta on y axis we haved moved
 *          velocityX   {Number}        the velocity on the x
 *          velocityY   {Number}        the velocity on y
 *          angle       {Number}        the angle we are moving
 *          direction   {String}        the direction we are moving. matches Hammer.DIRECTION_UP|DOWN|LEFT|RIGHT
 *          distance    {Number}        the distance we haved moved
 *          scale       {Number}        scaling of the touches, needs 2 touches
 *          rotation    {Number}        rotation of the touches, needs 2 touches *
 *          eventType   {String}        matches Hammer.EVENT_START|MOVE|END
 *          srcEvent    {Object}        the source event, like TouchStart or MouseDown *
 *          startEvent  {Object}        contains the same properties as above,
 *                                      but from the first touch. this is used to calculate
 *                                      distances, deltaTime, scaling etc
 *
 *      @param  {Hammer.Instance}    inst
 *      the instance we are doing the detection for. you can get the options from
 *      the inst.options object and trigger the gesture event by calling inst.trigger
 *
 *
 * Handle gestures
 * --------------------
 * inside the handler you can get/set Hammer.detection.current. This is the current
 * detection session. It has the following properties
 *      @param  {String}    name
 *      contains the name of the gesture we have detected. it has not a real function,
 *      only to check in other gestures if something is detected.
 *      like in the drag gesture we set it to 'drag' and in the swipe gesture we can
 *      check if the current gesture is 'drag' by accessing Hammer.detection.current.name
 *
 *      @readonly
 *      @param  {Hammer.Instance}    inst
 *      the instance we do the detection for
 *
 *      @readonly
 *      @param  {Object}    startEvent
 *      contains the properties of the first gesture detection in this session.
 *      Used for calculations about timing, distance, etc.
 *
 *      @readonly
 *      @param  {Object}    lastEvent
 *      contains all the properties of the last gesture detect in this session.
 *
 * after the gesture detection session has been completed (user has released the screen)
 * the Hammer.detection.current object is copied into Hammer.detection.previous,
 * this is usefull for gestures like doubletap, where you need to know if the
 * previous gesture was a tap
 *
 * options that have been set by the instance can be received by calling inst.options
 *
 * You can trigger a gesture event by calling inst.trigger("mygesture", event).
 * The first param is the name of your gesture, the second the event argument
 *
 *
 * Register gestures
 * --------------------
 * When an gesture is added to the Hammer.gestures object, it is auto registered
 * at the setup of the first Hammer instance. You can also call Hammer.detection.register
 * manually and pass your gesture object as a param
 *
 */

/**
 * Hold
 * Touch stays at the same place for x time
 * @events  hold
 */
Hammer.gestures.Hold = {
    name: 'hold',
    index: 10,
    defaults: {
        hold_timeout	: 500,
        hold_threshold	: 1
    },
    timer: null,
    handler: function holdGesture(ev, inst) {
        switch(ev.eventType) {
            case Hammer.EVENT_START:
                // clear any running timers
                clearTimeout(this.timer);

                // set the gesture so we can check in the timeout if it still is
                Hammer.detection.current.name = this.name;

                // set timer and if after the timeout it still is hold,
                // we trigger the hold event
                this.timer = setTimeout(function() {
                    if(Hammer.detection.current.name == 'hold') {
                        inst.trigger('hold', ev);
                    }
                }, inst.options.hold_timeout);
                break;

            // when you move or end we clear the timer
            case Hammer.EVENT_MOVE:
                if(ev.distance > inst.options.hold_threshold) {
                    clearTimeout(this.timer);
                }
                break;

            case Hammer.EVENT_END:
                clearTimeout(this.timer);
                break;
        }
    }
};


/**
 * Tap/DoubleTap
 * Quick touch at a place or double at the same place
 * @events  tap, doubletap
 */
Hammer.gestures.Tap = {
    name: 'tap',
    index: 100,
    defaults: {
        tap_max_touchtime	: 250,
        tap_max_distance	: 10,
		tap_always			: true,
        doubletap_distance	: 20,
        doubletap_interval	: 300
    },
    handler: function tapGesture(ev, inst) {
        if(ev.eventType == Hammer.EVENT_END) {
            // previous gesture, for the double tap since these are two different gesture detections
            var prev = Hammer.detection.previous,
				did_doubletap = false;

            // when the touchtime is higher then the max touch time
            // or when the moving distance is too much
            if(ev.deltaTime > inst.options.tap_max_touchtime ||
                ev.distance > inst.options.tap_max_distance) {
                return;
            }

            // check if double tap
            if(prev && prev.name == 'tap' &&
                (ev.timeStamp - prev.lastEvent.timeStamp) < inst.options.doubletap_interval &&
                ev.distance < inst.options.doubletap_distance) {
				inst.trigger('doubletap', ev);
				did_doubletap = true;
            }

			// do a single tap
			if(!did_doubletap || inst.options.tap_always) {
				Hammer.detection.current.name = 'tap';
				inst.trigger(Hammer.detection.current.name, ev);
			}
        }
    }
};


/**
 * Swipe
 * triggers swipe events when the end velocity is above the threshold
 * @events  swipe, swipeleft, swiperight, swipeup, swipedown
 */
Hammer.gestures.Swipe = {
    name: 'swipe',
    index: 40,
    defaults: {
        // set 0 for unlimited, but this can conflict with transform
        swipe_max_touches  : 1,
        swipe_velocity     : 0.7
    },
    handler: function swipeGesture(ev, inst) {
        if(ev.eventType == Hammer.EVENT_END) {
            // max touches
            if(inst.options.swipe_max_touches > 0 &&
                ev.touches.length > inst.options.swipe_max_touches) {
                return;
            }

            // when the distance we moved is too small we skip this gesture
            // or we can be already in dragging
            if(ev.velocityX > inst.options.swipe_velocity ||
                ev.velocityY > inst.options.swipe_velocity) {
                // trigger swipe events
                inst.trigger(this.name, ev);
                inst.trigger(this.name + ev.direction, ev);
            }
        }
    }
};


/**
 * Drag
 * Move with x fingers (default 1) around on the page. Blocking the scrolling when
 * moving left and right is a good practice. When all the drag events are blocking
 * you disable scrolling on that area.
 * @events  drag, drapleft, dragright, dragup, dragdown
 */
Hammer.gestures.Drag = {
    name: 'drag',
    index: 50,
    defaults: {
        drag_min_distance : 10,
        // set 0 for unlimited, but this can conflict with transform
        drag_max_touches  : 1,
        // prevent default browser behavior when dragging occurs
        // be careful with it, it makes the element a blocking element
        // when you are using the drag gesture, it is a good practice to set this true
        drag_block_horizontal   : false,
        drag_block_vertical     : false,
        // drag_lock_to_axis keeps the drag gesture on the axis that it started on,
        // It disallows vertical directions if the initial direction was horizontal, and vice versa.
        drag_lock_to_axis       : false,
        // drag lock only kicks in when distance > drag_lock_min_distance
        // This way, locking occurs only when the distance has become large enough to reliably determine the direction
        drag_lock_min_distance : 25
    },
    triggered: false,
    handler: function dragGesture(ev, inst) {
        // current gesture isnt drag, but dragged is true
        // this means an other gesture is busy. now call dragend
        if(Hammer.detection.current.name != this.name && this.triggered) {
            inst.trigger(this.name +'end', ev);
            this.triggered = false;
            return;
        }

        // max touches
        if(inst.options.drag_max_touches > 0 &&
            ev.touches.length > inst.options.drag_max_touches) {
            return;
        }

        switch(ev.eventType) {
            case Hammer.EVENT_START:
                this.triggered = false;
                break;

            case Hammer.EVENT_MOVE:
                // when the distance we moved is too small we skip this gesture
                // or we can be already in dragging
                if(ev.distance < inst.options.drag_min_distance &&
                    Hammer.detection.current.name != this.name) {
                    return;
                }

                // we are dragging!
                Hammer.detection.current.name = this.name;

                // lock drag to axis?
                if(Hammer.detection.current.lastEvent.drag_locked_to_axis || (inst.options.drag_lock_to_axis && inst.options.drag_lock_min_distance<=ev.distance)) {
                    ev.drag_locked_to_axis = true;
                }
                var last_direction = Hammer.detection.current.lastEvent.direction;
                if(ev.drag_locked_to_axis && last_direction !== ev.direction) {
                    // keep direction on the axis that the drag gesture started on
                    if(Hammer.utils.isVertical(last_direction)) {
                        ev.direction = (ev.deltaY < 0) ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
                    }
                    else {
                        ev.direction = (ev.deltaX < 0) ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
                    }
                }

                // first time, trigger dragstart event
                if(!this.triggered) {
                    inst.trigger(this.name +'start', ev);
                    this.triggered = true;
                }

                // trigger normal event
                inst.trigger(this.name, ev);

                // direction event, like dragdown
                inst.trigger(this.name + ev.direction, ev);

                // block the browser events
                if( (inst.options.drag_block_vertical && Hammer.utils.isVertical(ev.direction)) ||
                    (inst.options.drag_block_horizontal && !Hammer.utils.isVertical(ev.direction))) {
                    ev.preventDefault();
                }
                break;

            case Hammer.EVENT_END:
                // trigger dragend
                if(this.triggered) {
                    inst.trigger(this.name +'end', ev);
                }

                this.triggered = false;
                break;
        }
    }
};


/**
 * Transform
 * User want to scale or rotate with 2 fingers
 * @events  transform, pinch, pinchin, pinchout, rotate
 */
Hammer.gestures.Transform = {
    name: 'transform',
    index: 45,
    defaults: {
        // factor, no scale is 1, zoomin is to 0 and zoomout until higher then 1
        transform_min_scale     : 0.01,
        // rotation in degrees
        transform_min_rotation  : 1,
        // prevent default browser behavior when two touches are on the screen
        // but it makes the element a blocking element
        // when you are using the transform gesture, it is a good practice to set this true
        transform_always_block  : false
    },
    triggered: false,
    handler: function transformGesture(ev, inst) {
        // current gesture isnt drag, but dragged is true
        // this means an other gesture is busy. now call dragend
        if(Hammer.detection.current.name != this.name && this.triggered) {
            inst.trigger(this.name +'end', ev);
            this.triggered = false;
            return;
        }

        // atleast multitouch
        if(ev.touches.length < 2) {
            return;
        }

        // prevent default when two fingers are on the screen
        if(inst.options.transform_always_block) {
            ev.preventDefault();
        }

        switch(ev.eventType) {
            case Hammer.EVENT_START:
                this.triggered = false;
                break;

            case Hammer.EVENT_MOVE:
                var scale_threshold = Math.abs(1-ev.scale);
                var rotation_threshold = Math.abs(ev.rotation);

                // when the distance we moved is too small we skip this gesture
                // or we can be already in dragging
                if(scale_threshold < inst.options.transform_min_scale &&
                    rotation_threshold < inst.options.transform_min_rotation) {
                    return;
                }

                // we are transforming!
                Hammer.detection.current.name = this.name;

                // first time, trigger dragstart event
                if(!this.triggered) {
                    inst.trigger(this.name +'start', ev);
                    this.triggered = true;
                }

                inst.trigger(this.name, ev); // basic transform event

                // trigger rotate event
                if(rotation_threshold > inst.options.transform_min_rotation) {
                    inst.trigger('rotate', ev);
                }

                // trigger pinch event
                if(scale_threshold > inst.options.transform_min_scale) {
                    inst.trigger('pinch', ev);
                    inst.trigger('pinch'+ ((ev.scale < 1) ? 'in' : 'out'), ev);
                }
                break;

            case Hammer.EVENT_END:
                // trigger dragend
                if(this.triggered) {
                    inst.trigger(this.name +'end', ev);
                }

                this.triggered = false;
                break;
        }
    }
};


/**
 * Touch
 * Called as first, tells the user has touched the screen
 * @events  touch
 */
Hammer.gestures.Touch = {
    name: 'touch',
    index: -Infinity,
    defaults: {
        // call preventDefault at touchstart, and makes the element blocking by
        // disabling the scrolling of the page, but it improves gestures like
        // transforming and dragging.
        // be careful with using this, it can be very annoying for users to be stuck
        // on the page
        prevent_default: false,

        // disable mouse events, so only touch (or pen!) input triggers events
        prevent_mouseevents: false
    },
    handler: function touchGesture(ev, inst) {
        if(inst.options.prevent_mouseevents && ev.pointerType == Hammer.POINTER_MOUSE) {
            ev.stopDetect();
            return;
        }

        if(inst.options.prevent_default) {
            ev.preventDefault();
        }

        if(ev.eventType ==  Hammer.EVENT_START) {
            inst.trigger(this.name, ev);
        }
    }
};


/**
 * Release
 * Called as last, tells the user has released the screen
 * @events  release
 */
Hammer.gestures.Release = {
    name: 'release',
    index: Infinity,
    handler: function releaseGesture(ev, inst) {
        if(ev.eventType ==  Hammer.EVENT_END) {
            inst.trigger(this.name, ev);
        }
    }
};

// node export
if(typeof module === 'object' && typeof module.exports === 'object'){
    module.exports = Hammer;
}
// just window export
else {
    window.Hammer = Hammer;

    // requireJS module definition
    if(typeof window.define === 'function' && window.define.amd) {
        window.define('hammer', [], function() {
            return Hammer;
        });
    }
}
})(this);
/*
 * Angular Hammer v2
 *
 * Forked from https://github.com/randallb/angular-hammer
 * Updated to support https://github.com/EightMedia/hammer.js
 *
 * Within an Angular.js application, allows you to specify custom behaviour on Hammer.js touch events.
 *
 * Usage, currently as attribute only:
 *
 *    hm-tap="{expression}"
 *
 * You can change the default settings for the instance by adding a second attribute with options:
 *
 *    hm-options="{drag: false, transform: false}"
 *
 * Include this file, and add `hmTouchevents` to your app's dependencies.
 *
 * Requires Hammer.js, tested with `v1.0.1 - 2013-02-26`.
 *
 */

var hmTouchevents = angular.module('hmTouchevents', []),
    hmGestures = ['hmHold:hold',
                  'hmTap:tap',
                  'hmDoubletap:doubletap',
                  'hmDrag:drag',
                  'hmDragstart:dragstart',
                  'hmDragend:dragend',
                  'hmDragup:dragup',
                  'hmDragdown:dragdown',
                  'hmDragleft:dragleft',
                  'hmDragright:dragright',
                  'hmSwipe:swipe',
                  'hmSwipeup:swipeup',
                  'hmSwipedown:swipedown',
                  'hmSwipeleft:swipeleft',
                  'hmSwiperight:swiperight',
                  'hmTransformstart:transformstart',
                  'hmTransform:transform',
                  'hmTransformend:transformend',
                  'hmRotate:rotate',
                  'hmPinch:pinch',
                  'hmPinchin:pinchin',
                  'hmPinchout:pinchout',
                  'hmTouch:touch',
                  'hmRelease:release'];

angular.forEach(hmGestures, function(name){
  var directive = name.split(':'),
  directiveName = directive[0],
  eventName = directive[1];
  hmTouchevents.directive(directiveName, ["$parse", function($parse) {
    return {
      scope: true,
      link: function(scope, element, attr) {
        var fn, opts;
        fn = $parse(attr[directiveName]);
        opts = $parse(attr["hmOptions"])(scope, {});
        if(opts && opts.group) {
          scope.hammer = scope.hammer || Hammer(element[0], opts);
        } else {
          scope.hammer = Hammer(element[0], opts);
        }
        return scope.hammer.on(eventName, function(event) {
          return scope.$apply(function() {
            return fn(scope, {
              $event: event
            });
          });
        });
      }
    };
    }
  ]);
});

var leafletDirective = angular.module("leaflet-directive", []);

leafletDirective.directive('leaflet', [
    '$http', '$log', '$parse', '$rootScope', function ($http, $log, $parse, $rootScope) {

    var defaults = {
        maxZoom: 14,
        minZoom: 1,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        tileLayer: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        tileLayerOptions: {
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        },
        icon: {
            url: 'http://cdn.leafletjs.com/leaflet-0.5.1/images/marker-icon.png',
            retinaUrl: 'http://cdn.leafletjs.com/leaflet-0.5.1/images/marker-icon@2x.png',
            size: [25, 41],
            anchor: [12, 40],
            popup: [0, -40],
            shadow: {
                url: 'http://cdn.leafletjs.com/leaflet-0.5.1/images/marker-shadow.png',
                retinaUrl: 'http://cdn.leafletjs.com/leaflet-0.5.1/images/marker-shadow.png',
                size: [41, 41],
                anchor: [12, 40]
            }
        },
        path: {
            weight: 10,
            opacity: 1,
            color: '#0000ff'
        },
        center: {
            lat: 0,
            lng: 0,
            zoom: 10
        }
    };

    // Default leaflet icon object used in all markers as a default
    var LeafletIcon = L.Icon.extend({
        options: {
            iconUrl: defaults.icon.url,
            iconRetinaUrl: defaults.icon.retinaUrl,
            iconSize: defaults.icon.size,
            iconAnchor: defaults.icon.anchor,
            popupAnchor: defaults.icon.popup,
            shadowUrl: defaults.icon.shadow.url,
            shadowRetinaUrl: defaults.icon.shadow.retinaUrl,
            shadowSize: defaults.icon.shadow.size,
            shadowAnchor: defaults.icon.shadow.anchor
        }
    });

    var Helpers = {
        AwesomeMarkersPlugin: {
            isLoaded: function() {
                if (L.AwesomeMarkers !== undefined) {
                    return (L.AwesomeMarkers.Icon !== undefined);
                } else {
                    return false;
                }
            },
            is: function(icon) {
                if (this.isLoaded()) {
                    return icon instanceof L.AwesomeMarkers.Icon;
                } else {
                    return false;
                }
            },
            equal: function (iconA, iconB) {
                if (!this.isLoaded) {
                    $log.error('[AngularJS - Leaflet] AwesomeMarkers Plugin not Loaded');
                    return false;
                }
                if (this.is(iconA) && this.is(iconB)) {
                    return (iconA.options.icon === iconB.options.icon &&
                            iconA.options.iconColor === iconB.options.iconColor &&
                            iconA.options.color === iconB.options.color &&
                            iconA.options.iconSize[0] === iconB.options.iconSize[0] &&
                            iconA.options.iconSize[1] === iconB.options.iconSize[1] &&
                            iconA.options.iconAnchor[0] === iconB.options.iconAnchor[0] &&
                            iconA.options.iconAnchor[1] === iconB.options.iconAnchor[1] &&
                            iconA.options.popupAnchor[0] === iconB.options.popupAnchor[0] &&
                            iconA.options.popupAnchor[1] === iconB.options.popupAnchor[1] &&
                            iconA.options.shadowAnchor[0] === iconB.options.shadowAnchor[0] &&
                            iconA.options.shadowAnchor[1] === iconB.options.shadowAnchor[1] &&
                            iconA.options.shadowSize[0] === iconB.options.shadowSize[0] &&
                            iconA.options.shadowSize[1] === iconB.options.shadowSize[1]);
                } else {
                    return false;
                }
            }
        },
        MarkerClusterPlugin: {
            isLoaded: function() {
                return L.MarkerClusterGroup !== undefined;
            },
            is: function(layer) {
                if (this.isLoaded()) {
                    return layer instanceof L.MarkerClusterGroup;
                } else {
                    return false;
                }
            },
        },
        GoogleLayerPlugin: {
            isLoaded: function() {
                return L.Google !== undefined;
            },
            is: function(layer) {
                if (this.isLoaded()) {
                    return layer instanceof L.Google;
                } else {
                    return false;
                }
            },
        },
        Leaflet: {
            DivIcon: {
                is: function(icon) {
                    return icon instanceof L.DivIcon;
                },
                equal: function(iconA, iconB) {
                    if (this.is(iconA) && this.is(iconB)) {
                        return (iconA.options.html === iconB.options.html &&
                                iconA.options.iconSize[0] === iconB.options.iconSize[0] &&
                                iconA.options.iconSize[1] === iconB.options.iconSize[1] &&
                                iconA.options.iconAnchor[0] === iconB.options.iconAnchor[0] &&
                                iconA.options.iconAnchor[1] === iconB.options.iconAnchor[1]);
                    } else {
                        return false;
                    }
                }
            },
            Icon: {
                is: function(icon) {
                    return icon instanceof L.Icon;
                },
                equal: function(iconA, iconB) {
                    if (this.is(iconA) && this.is(iconB)) {
                        return (iconA.options.iconUrl === iconB.options.iconUrl &&
                                iconA.options.iconRetinaUrl === iconB.options.iconRetinaUrl &&
                                iconA.options.iconSize[0] === iconB.options.iconSize[0] &&
                                iconA.options.iconSize[1] === iconB.options.iconSize[1] &&
                                iconA.options.iconAnchor[0] === iconB.options.iconAnchor[0] &&
                                iconA.options.iconAnchor[1] === iconB.options.iconAnchor[1] &&
                                iconA.options.shadowUrl === iconB.options.shadowUrl &&
                                iconA.options.shadowRetinaUrl === iconB.options.shadowRetinaUrl &&
                                iconA.options.shadowSize[0] === iconB.options.shadowSize[0] &&
                                iconA.options.shadowSize[1] === iconB.options.shadowSize[1] &&
                                iconA.options.shadowAnchor[0] === iconB.options.shadowAnchor[0] &&
                                iconA.options.shadowAnchor[1] === iconB.options.shadowAnchor[1] &&
                                iconA.options.popupAnchor[0] === iconB.options.popupAnchor[0] &&
                                iconA.options.popupAnchor[1] === iconB.options.popupAnchor[1]);
                    } else {
                        return false;
                    }
                }
            }

        }
    };

    var str_inspect_hint = 'Add testing="testing" to <leaflet> tag to inspect this object';

    return {
        restrict: "E",
        replace: true,
        transclude: true,
        scope: {
            center: '=center',
            maxBounds: '=maxbounds',
            bounds: '=bounds',
            marker: '=marker',
            markers: '=markers',
            legend: '=legend',
            geojson: '=geojson',
            defaults: '=defaults',
            paths: '=paths',
            tiles: '=tiles',
            events: '=events',
            layers: '=layers',
            customControls: '=customControls'
        },
        template: '<div class="angular-leaflet-map"></div>',
        link: function ($scope, element, attrs /*, ctrl */) {
            if (attrs.width) {
                element.css('width', attrs.width);
            }
            if (attrs.height) {
                element.css('height', attrs.height);
            }

            $scope.leaflet = {};

            $scope.leaflet.maxZoom = !!(attrs.defaults && $scope.defaults && $scope.defaults.maxZoom) ?
                parseInt($scope.defaults.maxZoom, 10) : defaults.maxZoom;
            $scope.leaflet.minZoom = !!(attrs.defaults && $scope.defaults && $scope.defaults.minZoom) ?
                parseInt($scope.defaults.minZoom, 10) : defaults.minZoom;
            $scope.leaflet.doubleClickZoom = !!(attrs.defaults && $scope.defaults && (typeof($scope.defaults.doubleClickZoom) === "boolean") ) ? $scope.defaults.doubleClickZoom  : defaults.doubleClickZoom;
            $scope.leaflet.scrollWheelZoom = !!(attrs.defaults && $scope.defaults && (typeof($scope.defaults.scrollWheelZoom) === "boolean") ) ? $scope.defaults.scrollWheelZoom  : defaults.scrollWheelZoom;

            var map = new L.Map(element[0], {
                maxZoom: $scope.leaflet.maxZoom,
                minZoom: $scope.leaflet.minZoom,
                doubleClickZoom: $scope.leaflet.doubleClickZoom,
                scrollWheelZoom: $scope.leaflet.scrollWheelZoom
            });
            var layers = null;

            map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
            $scope.leaflet.map = !!attrs.testing ? map : str_inspect_hint;

            setupControls();
            setupCustomControls();
            setupLayers();
            setupCenter();
            setupMaxBounds();
            setupBounds();
            setupMainMarker();
            setupMarkers();
            setupPaths();
            setupLegend();
            setupMapEventBroadcasting();
            setupMapEventCallbacks();
            setupGeojson();

            // use of leafletDirectiveSetMap event is not encouraged. only use
            // it when there is no easy way to bind data to the directive
            $scope.$on('leafletDirectiveSetMap', function(event, message) {
                var meth = message.shift();
                map[meth].apply(map, message);
            });

            function _isSafeToApply() {
                var phase = $scope.$root.$$phase;
                return !(phase === '$apply' || phase === '$digest');
            }

            function safeApply(fn) {
                if (!_isSafeToApply()) {
                    $scope.$eval(fn);
                } else {
                    $scope.$apply(fn);
                }
            }

            /*
            * Set up broadcasting of map events to the rootScope
            *
            * Listeners listen at leafletDirectiveMap.<event name>
            *
            * All events listed at http://leafletjs.com/reference.html#map-events are supported
            */
            function setupMapEventBroadcasting() {

              function genDispatchMapEvent(eventName) {
                return function(e) {
                  // Put together broadcast name for use in safeApply
                  var broadcastName = 'leafletDirectiveMap.' + eventName;

                  // Safely broadcast the event
                  safeApply(function(scope) {
                    $rootScope.$broadcast(broadcastName, {
                      leafletEvent: e
                    });
                  });
                };
              }

              var mapEvents = [
                'click',
                'dblclick',
                'mousedown',
                'mouseup',
                'mouseover',
                'mouseout',
                'mousemove',
                'contextmenu',
                'focus',
                'blur',
                'preclick',
                'load',
                'unload',
                'viewreset',
                'movestart',
                'move',
                'moveend',
                'dragstart',
                'drag',
                'dragend',
                'zoomstart',
                'zoomend',
                'zoomlevelschange',
                'resize',
                'autopanstart',
                'layeradd',
                'layerremove',
                'baselayerchange',
                'overlayadd',
                'overlayremove',
                'locationfound',
                'locationerror',
                'popupopen',
                'popupclose'
              ];

              for (var i = 0; i < mapEvents.length; i++) {
                var eventName = mapEvents[i];

                map.on(eventName, genDispatchMapEvent(eventName), {
                  eventName: eventName
                });
              }
            }

            /*
             * Event setup watches for callbacks set in the parent scope
             *
             *    $scope.events = {
             *      dblclick: function(){
             *         // doThis()
             *      },
             *      click: function(){
             *         // doThat()
             *      }
             * }
             */

            function setupMapEventCallbacks() {
                if (typeof($scope.events) !== 'object') {
                    return false;
                } else {
                    for (var bind_to  in $scope.events) {
                        map.on(bind_to, $scope.events[bind_to]);
                    }
                }
            }

            function setupLayers() {
                //TODO: support multiple types of layers (or plugins) Canvas, ImageOverlay, clustermarker, google, etc
                //TODO: add support for controls
                if ($scope.layers === undefined || $scope.layers === null) {
                    // There is no layers definition so we will use the old way of definig tiles for compatibility
                    setupTiles();
                } else {
                    // Do we have a baselayers property?
                    if ($scope.layers.baselayers === undefined || $scope.layers.baselayers === null || typeof $scope.layers.baselayers !== 'object') {
                        // No baselayers property
                        $log.error('[AngularJS - Leaflet] At least one baselayer has to be defined');
                        $scope.leaflet.layers = !!attrs.testing ? layers : str_inspect_hint;
                        return;
                    } else if (Object.keys($scope.layers.baselayers).length <= 0) {
                        // We have a baselayers property but no element on it
                        $log.error('[AngularJS - Leaflet] At least one baselayer has to be defined');
                        $scope.leaflet.layers = !!attrs.testing ? layers : str_inspect_hint;
                        return;
                    }
                    // We have baselayers to add to the map
                    layers = {};
                    layers.baselayers = {};
                    layers.controls = {};
                    layers.controls.layers = new L.control.layers().addTo(map);
                    // Setup all baselayers definitions
                    var top = false;
                    for (var layerName in $scope.layers.baselayers) {
                        var newBaseLayer = createLayer($scope.layers.baselayers[layerName]);
                        if (newBaseLayer !== null) {
                            layers.baselayers[layerName] = newBaseLayer;
                            // Only add the visible layer to the map, layer control manages the addition to the map
                            // of layers in its control
                            if ($scope.layers.baselayers[layerName].top === true) {
                                map.addLayer(layers.baselayers[layerName]);
                                top = true;
                            }
                            layers.controls.layers.addBaseLayer(layers.baselayers[layerName], $scope.layers.baselayers[layerName].name);
                        }
                    }
                    // If there is no visible layer add first to the map
                    if (!top && Object.keys(layers.baselayers).length > 0) {
                        map.addLayer(layers.baselayers[Object.keys($scope.layers.baselayers)[0]]);
                    }
                    // Setup the Overlays
                    layers.overlays = {};
                    for (layerName in $scope.layers.overlays) {
                        var newOverlayLayer = createLayer($scope.layers.overlays[layerName]);
                        if (newOverlayLayer !== null) {
                            layers.overlays[layerName] = newOverlayLayer;
                            // Only add the visible layer to the map, layer control manages the addition to the map
                            // of layers in its control
                            if ($scope.layers.overlays[layerName].visible === true) {
                                map.addLayer(layers.overlays[layerName]);
                            }
                            layers.controls.layers.addOverlay(layers.overlays[layerName], $scope.layers.overlays[layerName].name);
                        }
                    }

                    // Watch for the base layers
                    $scope.$watch('layers.baselayers', function(newBaseLayers) {
                        // Delete layers from the array
                        var deleted = false;
                        for (var name in layers.baselayers) {
                            if (newBaseLayers[name] === undefined) {
                                // Remove the layer from the control
                                layers.controls.layers.removeLayer(layers.baselayers[name]);
                                // Remove from the map if it's on it
                                if (map.hasLayer(layers.baselayers[name])) {
                                    map.removeLayer(layers.baselayers[name]);
                                }
                                delete layers.baselayers[name];
                                deleted = true;
                            }
                        }
                        // add new layers
                        for (var new_name in newBaseLayers) {
                            if (layers.baselayers[new_name] === undefined) {
                                var testBaseLayer = createLayer(newBaseLayers[new_name]);
                                if (testBaseLayer !== null) {
                                    layers.baselayers[new_name] = testBaseLayer;
                                    // Only add the visible layer to the map, layer control manages the addition to the map
                                    // of layers in its control
                                    if (newBaseLayers[new_name].top === true) {
                                        map.addLayer(layers.baselayers[new_name]);
                                    }
                                    layers.controls.layers.addBaseLayer(layers.baselayers[new_name], newBaseLayers[new_name].name);
                                }
                            }
                        }
                        if (Object.keys(layers.baselayers).length <= 0) {
                            // No baselayers property
                            $log.error('[AngularJS - Leaflet] At least one baselayer has to be defined');
                        } else {
                            //we have layers, so we need to make, at least, one active
                            var found = false;
                            // serach for an active layer
                            for (var key in layers.baselayers) {
                                if (map.hasLayer(layers.baselayers[key])) {
                                    found = true;
                                    break;
                                }
                            }
                            // If there is no active layer make one active
                            if (!found) {
                                map.addLayer(layers.baselayers[Object.keys($scope.layers.baselayers)[0]]);
                            }
                        }
                    }, true);

                    // Watch for the overlay layers
                    $scope.$watch('layers.overlays', function(newOverlayLayers) {
                        // Delete layers from the array
                        for (var name in layers.overlays) {
                            if (newOverlayLayers[name] === undefined) {
                                // Remove the layer from the control
                                layers.controls.layers.removeLayer(layers.overlays[name]);
                                // Remove from the map if it's on it
                                if (map.hasLayer(layers.overlays[name])) {
                                    map.removeLayer(layers.overlays[name]);
                                }
                                // TODO: Depending on the layer type we will have to delete what's included on it
                                delete layers.overlays[name];
                            }
                        }
                        // add new layers
                        for (var new_name in newOverlayLayers) {
                            if (layers.overlays[new_name] === undefined) {
                                var testOverlayLayer = createLayer(newOverlayLayers[new_name]);
                                if (testOverlayLayer !== null) {
                                    layers.overlays[new_name] = testOverlayLayer;
                                    layers.controls.layers.addOverlay(layers.overlays[new_name], newOverlayLayers[new_name].name);
                                    if (newOverlayLayers[new_name].visible === true) {
                                        map.addLayer(layers.overlays[new_name]);
                                    }
                                }
                            }
                        }
                    }, true);
                }

                $scope.leaflet.layers = !!attrs.testing ? layers : str_inspect_hint;
            }

            function createLayer(layerDefinition) {
                // Check if the baselayer has a valid type
                if (layerDefinition.type === undefined || layerDefinition.type === null || typeof layerDefinition.type !== 'string') {
                    $log.error('[AngularJS - Leaflet] A base layer must have a type');
                    return null;
                } else if (layerDefinition.type !== 'xyz' && layerDefinition.type !== 'wms' && layerDefinition.type !== 'group' && layerDefinition.type !== 'markercluster'
                			&& layerDefinition.type !== 'google') {
                    $log.error('[AngularJS - Leaflet] A layer must have a valid type: "xyz, wms, group"');
                    return null;
                }
                if (layerDefinition.type === 'xyz' || layerDefinition.type === 'wms') {
                    // XYZ, WMS must have an url
                    if (layerDefinition.url === undefined || layerDefinition.url === null || typeof layerDefinition.url !== 'string') {
                        $log.error('[AngularJS - Leaflet] A base layer must have an url');
                        return null;
                    }
                }
                if (layerDefinition.name === undefined || layerDefinition.name === null || typeof layerDefinition.name !== 'string') {
                    $log.error('[AngularJS - Leaflet] A base layer must have a name');
                    return null;
                }
                if (layerDefinition.layerParams === undefined || layerDefinition.layerParams === null || typeof layerDefinition.layerParams !== 'object') {
                    layerDefinition.layerParams = {};
                }
                if (layerDefinition.layerOptions === undefined || layerDefinition.layerOptions === null || typeof layerDefinition.layerOptions !== 'object') {
                    layerDefinition.layerOptions = {};
                }
                // Mix the layer specific parameters with the general Leaflet options. Although this is an overhead
                // the definition of a base layers is more 'clean' if the two types of parameters are differentiated
                var layer = null;
                for (var attrname in layerDefinition.layerParams) { layerDefinition.layerOptions[attrname] = layerDefinition.layerParams[attrname]; }
                switch (layerDefinition.type) {
                case 'xyz':
                    layer = createXyzLayer(layerDefinition.url, layerDefinition.layerOptions);
                    break;
                case 'wms':
                    layer = createWmsLayer(layerDefinition.url, layerDefinition.layerOptions);
                    break;
                case 'group':
                    layer = createGroupLayer();
                    break;
                case 'markercluster':
                    layer = createMarkerClusterLayer(layerDefinition.layerOptions);
                    break;
                case 'google':
                	layer = createGoogleLayer(layerDefinition.layerOptions);
                	break;
                default:
                    layer = null;
                }

                //TODO Add $watch to the layer properties

                return layer;
            }

            function createXyzLayer(url, options) {
                var layer = L.tileLayer(url, options);
                return layer;
            }

            function createWmsLayer(url, options) {
                var layer = L.tileLayer.wms(url, options);
                return layer;
            }

            function createGroupLayer() {
                var layer = L.layerGroup();
                return layer;
            }

            function createMarkerClusterLayer(options) {
                if (Helpers.MarkerClusterPlugin.isLoaded()) {
                    var layer = new L.MarkerClusterGroup(options);
                    return layer;
                } else {
                    return null;
                }
            }
            
            function createGoogleLayer(options) {
            	if (Helpers.GoogleLayerPlugin.isLoaded()) {
                    var layer = new L.Google(options);
                    return layer;
                } else {
                    return null;
                }
            }

            function setupTiles() {
                var tileLayerObj, key;
                $scope.leaflet.tileLayer = !!(attrs.defaults && $scope.defaults && $scope.defaults.tileLayer) ?
                                            $scope.defaults.tileLayer : defaults.tileLayer;

                if ($scope.defaults && $scope.defaults.tileLayerOptions) {
                    for (key in $scope.defaults.tileLayerOptions) {
                        defaults.tileLayerOptions[key] = $scope.defaults.tileLayerOptions[key];
                    }
                }

                if (attrs.tiles) {
                    if ($scope.tiles && $scope.tiles.url) {
                        $scope.leaflet.tileLayer = $scope.tiles.url;
                    }
                    if ($scope.tiles && $scope.tiles.options) {
                        for (key in $scope.tiles.options) {
                            defaults.tileLayerOptions[key] = $scope.tiles.options[key];
                        }
                    }

                    $scope.$watch("tiles.url", function (url) {
                        if (!url) {
                            return;
                        }
                        tileLayerObj.setUrl(url);
                    });
                }
                tileLayerObj = L.tileLayer($scope.leaflet.tileLayer, defaults.tileLayerOptions);
                tileLayerObj.addTo(map);

                $scope.leaflet.tileLayerObj = !!attrs.testing ? tileLayerObj : str_inspect_hint;
            }

            function setupLegend() {
                if ($scope.legend) {
                    if (!$scope.legend.colors || !$scope.legend.labels || $scope.legend.colors.length !== $scope.legend.labels.length) {
                         $log.warn("[AngularJS - Leaflet] legend.colors and legend.labels must be set.");
                    } else {
                        var position = $scope.legend.position || 'bottomright';
                        var legend = L.control({position: position });
                        legend.onAdd = function (map) {
                            var div = L.DomUtil.create('div', 'info legend');
                            for (var i = 0; i < $scope.legend.colors.length; i++) {
                                div.innerHTML +=
                                    '<i style="background:' + $scope.legend.colors[i] + '"></i> ' + $scope.legend.labels[i] + '<br />';
                            }
                            return div;
                        };
                        legend.addTo(map);
                    }
                }
            }

            function setupMaxBounds() {
                if (!$scope.maxBounds) {
                    return;
                }
                if ($scope.maxBounds.southWest && $scope.maxBounds.southWest.lat && $scope.maxBounds.southWest.lng && $scope.maxBounds.northEast && $scope.maxBounds.northEast.lat && $scope.maxBounds.northEast.lng) {
                    map.setMaxBounds(
                        new L.LatLngBounds(
                            new L.LatLng($scope.maxBounds.southWest.lat, $scope.maxBounds.southWest.lng),
                            new L.LatLng($scope.maxBounds.northEast.lat, $scope.maxBounds.northEast.lng)
                        )
                    );

                    $scope.$watch("maxBounds", function (maxBounds) {
                        if (maxBounds.southWest && maxBounds.northEast && maxBounds.southWest.lat && maxBounds.southWest.lng && maxBounds.northEast.lat && maxBounds.northEast.lng) {
                            map.setMaxBounds(
                                new L.LatLngBounds(
                                    new L.LatLng(maxBounds.southWest.lat, maxBounds.southWest.lng),
                                    new L.LatLng(maxBounds.northEast.lat, maxBounds.northEast.lng)
                                )
                            );
                        }
                    });
                }
            }

            function tryFitBounds(bounds) {
                if (!bounds) {
                    return;
                }

                var southWest = bounds.southWest;
                var northEast = bounds.northEast;
                if (southWest && northEast && southWest.lat && southWest.lng && northEast.lat && northEast.lng) {
                    var sw_latlng = new L.LatLng(southWest.lat, southWest.lng);
                    var ne_latlng = new L.LatLng(northEast.lat, northEast.lng);
                    map.fitBounds(new L.LatLngBounds(sw_latlng, ne_latlng));
                }
            }

            function setupBounds() {
                if (!$scope.bounds) {
                    return;
                }
                $scope.$watch('bounds', function(new_bounds) {
                    tryFitBounds(new_bounds);
                });
            }

            function setupCenter() {
                if (!$scope.center) {
                    $log.warn("[AngularJS - Leaflet] 'center' is undefined in the current scope, did you forget to initialize it?");
                    map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                    return;
                } else {
                    if ($scope.center.lat !== undefined && $scope.center.lat !== null && typeof $scope.center.lat === 'number' && $scope.center.lng !== undefined && $scope.center.lng !== null && typeof $scope.center.lng === 'number' && $scope.center.zoom !== undefined && $scope.center.zoom !== null && typeof $scope.center.zoom === 'number') {
                        map.setView([$scope.center.lat, $scope.center.lng], $scope.center.zoom );
                    } else if (attrs.center.autoDiscover === true ) {
                        map.locate({ setView: true, maxZoom: $scope.leaflet.maxZoom });
                    } else {
                        $log.warn("[AngularJS - Leaflet] 'center' is incorrect");
                        map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                    }
                }

                var centerModel = {
                    lat:  $parse("center.lat"),
                    lng:  $parse("center.lng"),
                    zoom: $parse("center.zoom")
                };

                $scope.$watch("center", function(center, old_center) {
                    if (!center) {
                        $log.warn("[AngularJS - Leaflet] 'center' have been removed?");
                        map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                        return;
                    }

                    if (old_center) {
                        if (center.lat !== undefined && center.lat !== null && typeof center.lat === 'number' && center.lng !== undefined && center.lng !== null && typeof center.lng === 'number' && center.zoom !== undefined && center.zoom !== null && typeof center.zoom === 'number') {
                            // We have a center
                            if (old_center.lat !== undefined && old_center.lat !== null && typeof old_center.lat === 'number' && old_center.lng !== undefined && old_center.lng !== null &&  typeof old_center.lng === 'number' && old_center.zoom !== undefined && old_center.zoom !== null &&  typeof old_center.zoom === 'number') {
                                // We also have a correct old center
                                if (center.lat !== old_center.lat || center.lng !== old_center.lng || center.zoom !== old_center.zoom) {
                                    // Update if they are different
                                    map.setView([center.lat, center.lng], center.zoom );
                                }
                            } else {
                                // We didn't have a correct old center so directly update
                                map.setView([center.lat, center.lng], center.zoom );
                            }
                        } else {
                            // We don't have a correct center
                            if (center.autoDiscover === true && old_center.autoDiscover !== true) {
                                // We have an autodiscover and different from the old, so update the center
                                map.locate({ setView: true, maxZoom: $scope.leaflet.maxZoom });
                            } else if (center.autoDiscover === undefined || center.autoDiscover === null) {
                                // Some problem with actual center? No center and no autodiscover
                                $log.warn("[AngularJS - Leaflet] 'center' is incorrect");
                                map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                            }
                        }
                    }
                }, true);

                map.on("moveend", function(/* event */) {
                    safeApply(function(scope) {
                        if (centerModel) {
                            centerModel.lat.assign(scope, map.getCenter().lat);
                            centerModel.lng.assign(scope, map.getCenter().lng);
                            centerModel.zoom.assign(scope, map.getZoom());
                        }
                    });
                });
            }

            function setupGeojson() {
                $scope.$watch("geojson", function(geojson) {
                    if (!geojson) {
                        return;
                    }

                    if ($scope.leaflet.geojson) {
                        map.removeLayer($scope.leaflet.geojson);
                    }

                    if (geojson.hasOwnProperty("data")) {
                        var resetStyleOnMouseout = $scope.geojson.resetStyleOnMouseout;

                        $scope.leaflet.geojson = L.geoJson($scope.geojson.data, {
                            style: $scope.geojson.style,
                            onEachFeature: function(feature, layer) {
                                layer.on({
                                    mouseover: function(e) {
                                        safeApply(function() {
                                            geojson.selected = feature;
                                            $rootScope.$broadcast('leafletDirectiveMap.geojsonMouseover', e);
                                        });
                                    },
                                    mouseout: function(e) {
                                        if (resetStyleOnMouseout) {
                                            $scope.leaflet.geojson.resetStyle(e.target);
                                        }
                                        safeApply(function() {
                                            geojson.selected = undefined;
                                            $rootScope.$broadcast('leafletDirectiveMap.geojsonMouseout', e);
                                        });
                                    },
                                    click: function(e) {
                                        safeApply(function() {
                                            $rootScope.$broadcast('leafletDirectiveMap.geojsonClick', geojson.selected, e);
                                        });
                                    }
                                });
                            }
                        }).addTo(map);
                    }
                });
            }

            function setupMainMarker() {
                var main_marker;
                if (!$scope.marker) {
                    return;
                }
                main_marker = createMarker('marker', $scope.marker, map);
                $scope.leaflet.marker = !!attrs.testing ? main_marker : str_inspect_hint;
                main_marker.on('click', function(e) {
                    safeApply(function() {
                        $rootScope.$broadcast('leafletDirectiveMainMarkerClick');
                    });
                });
            }

            function setupMarkers() {
                var markers = {};

                if (!$scope.markers) {
                    return;
                }

                for (var name in $scope.markers) {
                    var newMarker = createMarker('markers.'+name, $scope.markers[name], map);
                    if (newMarker !== null) {
                        markers[name] = newMarker;
                    }
                }

                $scope.$watch('markers', function(newMarkers) {
                    // Delete markers from the array
                    for (var name in markers) {
                        if (newMarkers[name] === undefined) {
                            // First we check if the marker is in a layer group
                            markers[name].closePopup();
                            // There is no easy way to know if a marker is added to a layer, so we search for it
                            // if there are overlays
                            if (layers !== undefined && layers !== null) {
                                if (layers.overlays !== undefined) {
                                    for (var key in layers.overlays) {
                                        if (layers.overlays[key] instanceof L.LayerGroup) {
                                            if (layers.overlays[key].hasLayer(markers[name])) {
                                                layers.overlays[key].removeLayer(markers[name]);
                                            }
                                        }
                                    }
                                }
                            }
                            // Remove the marker from the map
                            map.removeLayer(markers[name]);
                            // TODO: If we remove the marker we don't have to clear the $watches?
                            // Delete the marker
                            delete markers[name];
                        }
                    }
                    // add new markers
                    for (var new_name in newMarkers) {
                        if (markers[new_name] === undefined) {
                            var newMarker = createMarker('markers.'+new_name, $scope.markers[new_name], map);
                            if (newMarker !== null) {
                                markers[new_name] = newMarker;
                            }
                        }
                    }
                }, true);
                $scope.leaflet.markers = !!attrs.testing ? markers : str_inspect_hint;
            }

            function createMarker(scope_watch_name, marker_data, map) {
                var marker = buildMarker(marker_data);

                // Marker belongs to a layer group?
                if (marker_data.layer === undefined) {
                    // We do not have a layer attr, so the marker goes to the map layer
                    map.addLayer(marker);
                    if (marker_data.focus === true) {
                        marker.openPopup();
                    }
                } else if (typeof marker_data.layer === 'string') {
                    // There is a layer name so we will try to add it to the layer, first does the layer exists
                    if (layers.overlays[marker_data.layer] !== undefined) {
                        // Is a group layer?
                        var layerGroup = layers.overlays[marker_data.layer];
                        if (layerGroup instanceof L.LayerGroup) {
                            // The marker goes to a correct layer group, so first of all we add it
                            layerGroup.addLayer(marker);
                            // The marker is automatically added to the map depending on the visibility
                            // of the layer, so we only have to open the popup if the marker is in the map
                            if (map.hasLayer(marker)) {
                                if (marker_data.focus === true) {
                                    marker.openPopup();
                                }
                            }
                        } else {
                            $log.error('[AngularJS - Leaflet] A marker can only be added to a layer of type "group"');
                            return null;
                        }
                    } else {
                        $log.error('[AngularJS - Leaflet] You must use a name of an existing layer');
                        return null;
                    }
                } else {
                    $log.error('[AngularJS - Leaflet] A layername must be a string');
                    return null;
                }

                function genDispatchEventCB(eventName) {
                    return function(e) {
                        var broadcastName = 'leafletDirectiveMarker.' + eventName;
                        var markerName = scope_watch_name.replace('markers.', '');

                        // Broadcast old marker click name for backwards compatibility
                        if (eventName === "click") {
                            safeApply(function() {
                                $rootScope.$broadcast('leafletDirectiveMarkersClick', markerName);
                            });
                        } else if (eventName === 'dragend') {
                            safeApply(function() {
                                marker_data.lat = marker.getLatLng().lat;
                                marker_data.lng = marker.getLatLng().lng;
                            });
                            if (marker_data.message) {
                                if (marker_data.focus === true) {
                                    marker.openPopup();
                                }
                            }
                        }

                        safeApply(function(){
                            $rootScope.$broadcast(broadcastName, {
                                markerName: markerName,
                                leafletEvent: e
                            });
                        });
                    };
                }

                // Set up marker event broadcasting
                var markerEvents = [
                    'click',
                    'dblclick',
                    'mousedown',
                    'mouseover',
                    'mouseout',
                    'contextmenu',
                    'dragstart',
                    'drag',
                    'dragend',
                    'move',
                    'remove',
                    'popupopen',
                    'popupclose'
                ];

                for (var i = 0; i < markerEvents.length; i++) {
                    var eventName = markerEvents[i];
                    marker.on(eventName, genDispatchEventCB(eventName), {
                        eventName: eventName,
                        scope_watch_name: scope_watch_name
                    });
                }

                var clearWatch = $scope.$watch(scope_watch_name, function(data, old_data) {
                    if (!data) {
                        marker.closePopup();
                        // There is no easy way to know if a marker is added to a layer, so we search for it
                        // if there are overlays
                        if (layers !== undefined && layers !== null) {
                            if (layers.overlays !== undefined) {
                                for (var key in layers.overlays) {
                                    if (layers.overlays[key] instanceof L.LayerGroup) {
                                        if (layers.overlays[key].hasLayer(marker)) {
                                            layers.overlays[key].removeLayer(marker);
                                        }
                                    }
                                }
                            }
                        }
                        map.removeLayer(marker);
                        clearWatch();
                        return;
                    }

                    if (old_data) {

                        // Update the layer group if present or move it to the map if not
                        if (data.layer === undefined || data.layer === null || typeof data.layer !== 'string') {
                            // There is no layer information, we move the marker to the map if it was in a layer group
                            if (old_data.layer !== undefined && old_data.layer !== null && typeof old_data.layer === 'string') {
                                // Remove from the layer group that is supposed to be
                                if (layers.overlays[old_data.layer] !== undefined) {
                                    if (layers.overlays[old_data.layer].hasLayer(marker)) {
                                        layers.overlays[old_data.layer].removeLayer(marker);
                                        // If the marker had a popup we close it because we do not know if the popup in on the map
                                        // or on the layer group. This is ineficient, but as we can't check if the popup is opened
                                        // in Leaflet we can't determine if it has to be open in the new layer. So removing the
                                        // layer group of a marker always closes the popup.
                                        // TODO: Improve popup behaviour when removing a marker from a layer group
                                        marker.closePopup();
                                    }
                                }
                                // Test if it is not on the map and add it
                                if (!map.hasLayer(marker)) {
                                    map.addLayer(marker);
                                }
                            }
                        } else if (old_data.layer === undefined || old_data.layer === null || old_data.layer !== data.layer) {
                            // If it was on a layer group we have to remove it
                            if (typeof old_data.layer === 'string') {
                                if (layers.overlays[old_data.layer] !== undefined) {
                                    if (layers.overlays[old_data.layer].hasLayer(marker)) {
                                        layers.overlays[old_data.layer].removeLayer(marker);
                                    }
                                }
                            }
                            // If the marker had a popup we close it because we do not know how the new layer
                            // will be. This is ineficient, but as we can't check if the opoup is opened in Leaflet
                            // we can't determine if it has to be open in the new layer. So changing the layer group
                            // of a marker always closes the popup.
                            // TODO: Improve popup behaviour when changing a marker from a layer group
                            marker.closePopup();
                            // Remove it from the map in case the new layer is hidden or there is an error in the new layer
                            if (map.hasLayer(marker)) {
                                map.removeLayer(marker);
                            }
                            // The data.layer is defined so we add the marker to the layer if it is different from the old data
                            if (layers.overlays[data.layer] !== undefined) {
                                // Is a group layer?
                                var layerGroup = layers.overlays[data.layer];
                                if (layerGroup instanceof L.LayerGroup) {
                                    // The marker goes to a correct layer group, so first of all we add it
                                    layerGroup.addLayer(marker);
                                    // The marker is automatically added to the map depending on the visibility
                                    // of the layer, so we only have to open the popup if the marker is in the map
                                    if (map.hasLayer(marker)) {
                                        if (data.focus === true) {
                                            marker.openPopup();
                                        }
                                    }
                                } else {
                                    $log.error('[AngularJS - Leaflet] A marker can only be added to a layer of type "group"');
                                }
                            } else {
                                $log.error('[AngularJS - Leaflet] You must use a name of an existing layer');
                            }
                        } else {
                            // Never has to enter here...
                        }

                        // Update the draggable property
                        if (data.draggable === undefined || data.draggable === null || data.draggable !== true) {
                            // If there isn't or wasn't the draggable property or is false and previously true update the dragging
                            // the !== true prevents for not boolean values in the draggable property
                            if (old_data.draggable !== undefined && old_data.draggable !== null && old_data.draggable === true) {
                                marker.dragging.disable();
                            }
                        } else if (old_data.draggable === undefined || old_data.draggable === null || old_data.draggable !== true) {
                            // The data.draggable property must be true so we update if there wasn't a previous value or it wasn't true
                            marker.dragging.enable();
                        }

                        // Update the icon property
                        if (data.icon === undefined || data.icon === null || typeof data.icon !== 'object') {
                            // If there is no icon property or it's not an object
                            if (old_data.icon !== undefined && old_data.icon !== null && typeof old_data.icon === 'object') {
                                // If there was an icon before restore to the default
                                marker.setIcon(new LeafletIcon());
                                marker.closePopup();
                                marker.unbindPopup();
                                if (data.message !== undefined && data.message !== null && typeof data.message === 'string' && data.message !== "") {
                                    marker.bindPopup(data.message);
                                }
                            }
                        } else if (old_data.icon === undefined || old_data.icon === null || typeof old_data.icon !== 'object') {
                            // The data.icon exists so we create a new icon if there wasn't an icon before
                            var dragA = marker.dragging.enabled();
                            if (Helpers.AwesomeMarkersPlugin.is(data.icon)) {
                                // This icon is a L.AwesomeMarkers.Icon so it is using the AwesomeMarker PlugIn
                                marker.setIcon(data.icon);
                                // As the new icon creates a new DOM object some elements, as drag, are reseted.
                            } else if (Helpers.Leaflet.DivIcon.is(data.icon) || Helpers.Leaflet.Icon.is(data.icon)) {
                                // This is a Leaflet.DivIcon or a Leaflet.Icon
                                marker.setIcon(data.icon);
                            } else {
                                // This icon is a icon set in the model trough options
                                marker.setIcon(new LeafletIcon(data.icon));
                            }
                            if (dragA) {
                                marker.dragging.enable();
                            }
                            marker.closePopup();
                            marker.unbindPopup();
                            if (data.message !== undefined && data.message !== null && typeof data.message === 'string' && data.message !== "") {
                                marker.bindPopup(data.message);
                            }

                        } else {
                            if (Helpers.AwesomeMarkersPlugin.is(data.icon)) {
                                // This icon is a L.AwesomeMarkers.Icon so it is using the AwesomeMarker PlugIn
                                if (!Helpers.AwesomeMarkersPlugin.equal(data.icon, old_data.icon)) {
                                    var dragD = marker.dragging.enabled();
                                    marker.setIcon(data.icon);
                                    // As the new icon creates a new DOM object some elements, as drag, are reseted.
                                    if (dragD) {
                                        marker.dragging.enable();
                                    }
                                    //TODO: Improve depending on anchorPopup
                                    marker.closePopup();
                                    marker.unbindPopup();
                                    if (data.message !== undefined && data.message !== null && typeof data.message === 'string' && data.message !== "") {
                                        marker.bindPopup(data.message);
                                    }
                                }
                            } else if (Helpers.Leaflet.DivIcon.is(data.icon)) {
                                // This is a Leaflet.DivIcon
                                if (!Helpers.Leaflet.DivIcon.equal(data.icon, old_data.icon)) {
                                    var dragE = marker.dragging.enabled();
                                    marker.setIcon(data.icon);
                                    // As the new icon creates a new DOM object some elements, as drag, are reseted.
                                    if (dragE) {
                                        marker.dragging.enable();
                                    }
                                    //TODO: Improve depending on anchorPopup
                                    marker.closePopup();
                                    marker.unbindPopup();
                                    if (data.message !== undefined && data.message !== null && typeof data.message === 'string' && data.message !== "") {
                                        marker.bindPopup(data.message);
                                    }
                                }
                            } else if (Helpers.Leaflet.Icon.is(data.icon)) {
                                // This is a Leaflet.DivIcon
                                if (!Helpers.Leaflet.Icon.equal(data.icon, old_data.icon)) {
                                    var dragF = marker.dragging.enabled();
                                    marker.setIcon(data.icon);
                                    // As the new icon creates a new DOM object some elements, as drag, are reseted.
                                    if (dragF) {
                                        marker.dragging.enable();
                                    }
                                    //TODO: Improve depending on anchorPopup
                                    marker.closePopup();
                                    marker.unbindPopup();
                                    if (data.message !== undefined && data.message !== null && typeof data.message === 'string' && data.message !== "") {
                                        marker.bindPopup(data.message);
                                    }
                                }
                            } else {
                                // This icon is an icon defined in the marker model through options
                                // There is an icon and there was an icon so if they are different we create a new icon
                                if (JSON.stringify(data.icon) !== JSON.stringify(old_data.icon)) {
                                    var dragG = marker.dragging.enabled();
                                    marker.setIcon(new LeafletIcon(data.icon));
                                    if (dragG) {
                                        marker.dragging.enable();
                                    }
                                    //TODO: Improve depending on anchorPopup
                                    marker.closePopup();
                                    marker.unbindPopup();
                                    if (data.message !== undefined && data.message !== null && typeof data.message === 'string' && data.message !== "") {
                                        marker.bindPopup(data.message);
                                    }
                                }
                            }
                        }

                        // Update the Popup message property
                        if (data.message === undefined || data.message === null || typeof data.message !== 'string' || data.message === "") {
                            // There is no popup to show, so if it has previously existed it must be unbinded
                            if (old_data.message !== undefined && old_data.message !== null && typeof old_data.message === 'string' && old_data.message !== "") {
                                marker.closePopup();
                                marker.unbindPopup();
                            }
                        } else {
                            // There is some text in the popup, so we must show the text or update existing
                            if (old_data.message === undefined || old_data.message === null || typeof old_data.message !== 'string' || old_data.message === "") {
                                // There was no message before so we create it
                                marker.bindPopup(data.message);
                                if (data.focus === true) {
                                    // If the focus is set, we must open the popup, because we do not know if it was opened before
                                    marker.openPopup();
                                }
                            } else if (data.message !== old_data.message) {
                                // There was a different previous message so we update it
                                marker.setPopupContent(data.message);
                            }
                        }

                        // Update the focus property
                        if (data.focus === undefined || data.focus === null || data.focus !== true) {
                            // If there is no focus property or it's false
                            if (old_data.focus !== undefined && old_data.focus !== null && old_data.focus === true) {
                                // If there was a focus property and was true we turn it off
                                marker.closePopup();
                            }
                        } else if (old_data.focus === undefined || old_data.focus === null || old_data.focus !== true) {
                            // The data.focus property must be true so we update if there wasn't a previous value or it wasn't true
                            marker.openPopup();
                        }

                        // Update the lat-lng property (always present in marker properties)
                        if (data.lat === undefined || data.lat === null || isNaN(data.lat) || typeof data.lat !== 'number' || data.lng === undefined || data.lng === null || isNaN(data.lng) || typeof data.lng !== 'number') {
                            $log.warn('There are problems with lat-lng data, please verify your marker model');
                            // Remove the marker from the layers and map if it is not valid
                            if (layers !== undefined) {
                                if (layers.overlays !== undefined) {
                                    for (var olname in layers.overlays) {
                                        if (layers.overlays[olname] instanceof L.LayerGroup) {
                                            if (layers.overlays[olname].hasLayer(marker)) {
                                                layers.overlays[olname].removeLayer(marker);
                                            }
                                        }
                                    }
                                }
                            }
                            map.removeLayer(marker);
                        } else {
                            var cur_latlng = marker.getLatLng();
                            // On dragend event, scope will be updated, which
                            // tirggers this watch expression. Then we call
                            // setLatLng and triggers move event on marker and
                            // causes digest already in progress error.
                            //
                            // This check is to make sure we don't trigger move
                            // event manually after dragend, which is redundant
                            // anyway. Because before dragend event fired, marker
                            // sate is already updated by leaflet.
                            if (cur_latlng.lat !== data.lat || cur_latlng.lng !== data.lng) {
                                // if the marker is in a clustermarker layer it has to be removed and added again to the layer
                                var isCluster = false;
                                if (data.layer !== undefined && data.layer !== null && typeof data.layer === 'string') {
                                    if (Helpers.MarkerClusterPlugin.is(layers.overlays[data.layer])) {
                                        layers.overlays[data.layer].removeLayer(marker);
                                        isCluster = true;
                                    }
                                }
                                marker.setLatLng([data.lat, data.lng]);
                                if (isCluster) {
                                    layers.overlays[data.layer].addLayer(marker);
                                }
                            }
                        }
                    }
                }, true);
                return marker;
            }

            function buildMarker(data) {
                var micon = null;
                if (data.icon) {
                    micon = data.icon;
                } else {
                    micon = new LeafletIcon();
                }
                var moptions = {
                    icon: micon,
                    draggable: data.draggable ? true : false
                };
                if (data.title) {
                    moptions.title = data.title;
                }
                var marker = new L.marker(data, moptions);
                if (data.message) {
                    marker.bindPopup(data.message);
                }
                return marker;
            }

            function setupPaths() {
                var paths = {};
                $scope.leaflet.paths = !!attrs.testing ? paths : str_inspect_hint;

                if (!$scope.paths) {
                    return;
                }

                $log.warn("[AngularJS - Leaflet] Creating polylines and adding them to the map will break the directive's scope's inspection in AngularJS Batarang");

                for (var name in $scope.paths) {
                    paths[name] = createPath(name, $scope.paths[name], map);
                }

                $scope.$watch("paths", function (newPaths) {
                    for (var new_name in newPaths) {
                        if (paths[new_name] === undefined) {
                            paths[new_name] = createPath(new_name, newPaths[new_name], map);
                        }
                    }
                    // Delete paths from the array
                    for (var name in paths) {
                        if (newPaths[name] === undefined) {
                            delete paths[name];
                        }
                    }

                }, true);
            }

            function createPath(name, scopePath, map) {
                var polyline = new L.Polyline([], {
                    weight: defaults.path.weight,
                    color: defaults.path.color,
                    opacity: defaults.path.opacity
                });

                if (scopePath.latlngs !== undefined) {
                    var latlngs = convertToLeafletLatLngs(scopePath.latlngs);
                    polyline.setLatLngs(latlngs);
                }

                if (scopePath.weight !== undefined) {
                    polyline.setStyle({ weight: scopePath.weight });
                }

                if (scopePath.color !== undefined) {
                    polyline.setStyle({ color: scopePath.color });
                }

                if (scopePath.opacity !== undefined) {
                    polyline.setStyle({ opacity: scopePath.opacity });
                }

                map.addLayer(polyline);

                var clearWatch = $scope.$watch('paths.' + name, function(data, oldData) {
                    if (!data) {
                        map.removeLayer(polyline);
                        clearWatch();
                        return;
                    }

                    if (oldData) {
                        if (data.latlngs !== undefined && data.latlngs !== oldData.latlngs) {
                            var latlngs = convertToLeafletLatLngs(data.latlngs);
                            polyline.setLatLngs(latlngs);
                        }

                        if (data.weight !== undefined && data.weight !== oldData.weight) {
                            polyline.setStyle({ weight: data.weight });
                        }

                        if (data.color !== undefined && data.color !== oldData.color) {
                            polyline.setStyle({ color: data.color });
                        }

                        if (data.opacity !== undefined && data.opacity !== oldData.opacity) {
                            polyline.setStyle({ opacity: data.opacity });
                        }
                    }
                }, true);
                return polyline;
            }

            function convertToLeafletLatLngs(latlngs) {
                var leafletLatLngs = latlngs.filter(function(latlng) {
                    return !!latlng.lat && !!latlng.lng;
                }).map(function (latlng) {
                    return new L.LatLng(latlng.lat, latlng.lng);
                });

                return leafletLatLngs;
            }

            function setupControls() {
                //@TODO add document for this option  11.08 2013 (houqp)
                if ($scope.defaults && $scope.defaults.zoomControlPosition) {
                    map.zoomControl.setPosition($scope.defaults.zoomControlPosition);
                }
            }

            function setupCustomControls() {
                if (!$scope.customControls) {
                    return;
                }

                for(var i = 0, count = $scope.customControls.length; i < count; i++) {
                    map.addControl(new $scope.customControls[i]());
                }
            }
        }
    };
}]);

/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

angular.module('ApiService', ['ngResource']).
    factory('Venue', function($resource) {
        'use strict';

        return $resource('api/v1/venues/:venueId.json', {}, {
            query: {method:'GET', params:{venueId: 'venues'}, isArray:true}
        });
    });

/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

var digiletme = angular.module('digiletme', [
        'ngRoute',
        'ApiService',
        'leaflet-directive',
        'FourSquare',
        'Carousel',
        'SmartIP',
        'hmTouchevents',
        'Location'
    ]);

angular.module('digiletme')
    .constant('DEF_ZOOM', 8);

digiletme
    .config(['$locationProvider', '$routeProvider', 'LocationProvider', function($locationProvider, $routeProvider, Location) {
        'use strict';

        $locationProvider.hashPrefix('!');

        $routeProvider
            .when('/location/:zoom?/:lat?/:lng?/:venueId?', {
                action: 'location',
                template: ''
            })
            .when('/venue/:venueId?', {
                action: 'venue',
                template: '',
                resolve: {
                    'Location': 'Location'
                }
                /*,
                redirectTo: function(pathParams) {
                    return Location.getLocation().then(function(location) {
                        return 'location/' + location.zoom + '/' + location.lat + '/' + location.lng + '/' + pathParams.venueId;
                    });
                }*/
            })
            .when('/photos/:venueId/:photoId', {
                action: 'photo',
                templateUrl: 'partials/photoPartial.html',
                controller: 'PhotoCtrl'
            })
            .otherwise({
                redirectTo: 'location/'
            });
    }])
    .constant('')
    .run(['FourSquareClient', function(FourSquareClient) {
        FourSquareClient.CLIENT_ID = '2WYFEWX521WPPTCQ3MKLLEGAHOW3EHPGLF1H4KXDB5OCQYT5';
        FourSquareClient.CLIENT_SECRET = 'TJ0ORRJ4VPQFZHQ3USFLV2TVBYJRQ1O30ZY5RCNXL5SM23IF';
    }]);

digiletme.controller('PhotosPreviewCarouselCtrl', ['$scope', function() {

}]);

digiletme.controller('RoutingCtrl', ['$scope', '$rootScope', 'VenuesAPI', 'Location', '$http', '$resource', '$q', '$location', '$timeout', '$window', function($scope, $rootScope, VenuesAPI, Location, $http, $resource, $q, $location, $timeout, $window) {
    'use strict';

    var storedScrollY = 0;

    $rootScope.$on('$routeChangeStart', function(event, next, current) {
        document.body.style.overflowY = 'auto';
        if (storedScrollY) {
            $window.scrollTo(0, storedScrollY);
            storedScrollY = 0;
            $timeout(function() {
            }, 100);
        }

        if (!next) {
            return;
        }

        switch(next.action) {
            case 'venue':
                Location.getLocation().then(function(location) {
                    $location.path('location/' + location.zoom + '/' + location.lat + '/' + location.lng + '/' + next.params.venueId);
                });
                break;
            case 'photo':
                $rootScope.$broadcast('selectPhoto', next.params.photoId);
                document.body.style.overflowY = 'hidden';
                storedScrollY = $window.scrollY;
                break;
            case 'location':
                if (next.params.hasOwnProperty('lat') &&
                    next.params.hasOwnProperty('lng') &&
                    next.params.hasOwnProperty('zoom')) {
                    Location.setLocation(Number(next.params.lat), Number(next.params.lng), Number(next.params.zoom));
                }

                if (next.params.venueId) {
                    $rootScope.$broadcast('selectVenue', next.params.venueId);
                }
                break;
            default:
                break;
        }
    });
}]);

digiletme.controller('SearchResultCtrl', ['$scope', '$rootScope', 'VenuesAPI', 'Location', '$http', '$resource', '$q', '$location', '$timeout', '$window', function($scope, $rootScope, VenuesAPI, Location, $http, $resource, $q, $location, $timeout, $window) {
    'use strict';

    $scope.hasVenuesWithoutPhotos = false;
    $scope.venuesWithoutPhotos = {};
    $scope.venues = {};
    $scope.waitForVenuesWithPhotos = true;
    VenuesAPI.getLocalVenues().then(function(resource) {
        $scope.waitForVenuesWithPhotos = false;
    });

    $rootScope.$on('showVenue', function(e, venue) {
        if ($scope.venues[venue.id]) {
            return;
        }

        $scope.venues[venue.id] = venue;
    });

    $rootScope.$on('hideVenue', function(e, venue) {
        if (!$scope.venues[venue.id]) {
            return;
        }

        $scope.venues[venue.id] = null;
    });

    $rootScope.$on('showVenueWithoutPhoto', function(e, venue) {
        if ($scope.venuesWithoutPhotos[venue.id]) {
            return;
        }

        $scope.venuesWithoutPhotos[venue.id] = venue;
        $scope.hasVenuesWithoutPhotos = true;
    });

    $rootScope.$on('hideVenueWithoutPhoto', function(e, venue) {
        if (!$scope.venuesWithoutPhotos[venue.id]) {
            return;
        }

        $scope.venuesWithoutPhotos[venue.id] = null;
//        $scope.hasVenuesWithoutPhotos = true;
    });
/*
    $rootScope.$on('newVenueWithoutPhotos', function(e, venue) {
        if ($scope.venuesWithoutPhotos[venue.id]) {
            return;
        }

        $scope.venuesWithoutPhotos[venue.id] = venue;
        $scope.hasVenuesWithoutPhotos = true;
    });*/


    $scope.concat4SQImg = function(icon, width, height) {
        if (!icon.prefix || !icon.suffix) {
            return '';
        }
        var prefix = icon.prefix.substr(0, icon.prefix.length - 1),
            middle = '',
            suffix = icon.suffix;

        if (width && height) {
            middle = '/' + width + 'x' + height;
        }

        return prefix + middle + suffix;
    };

    $scope.getDivStyleFor4SQImg = function(icon, width, height) {
        return {
            backgroundImage: 'url(\'' + $scope.concat4SQImg(icon, width, height) + '\')'
        };
    };

    $scope.getPhotosOfVenue = (function() {
        var cachedRequest = {},
            cachedValue = {};
        return function(venue) {
            if (cachedValue[venue.id]) {
                var photos = cachedValue[venue.id];
                venue.visible = photos.length > 0;
                return $q.when(photos);
            }

            if (!cachedRequest[venue.id]) {
                cachedRequest[venue.id] = VenuesAPI.getPhotosByVenueId(venue.id)
                    .then(function(result) {
                        cachedRequest[venue.id] = null;
                        cachedValue[venue.id] = result;
                        var hasPhotos = result.length > 0;
                        venue.visible = hasPhotos;
                        /*if (!hasPhotos) {
                            $scope.venuesWithoutPhotos.push(venue);
                        }*/

                        return result;
                    });
            }

            return cachedRequest[venue.id];
        };
    })();

    var GoogleReverseGeocoding = $resource(
        'http://maps.googleapis.com/maps/api/geocode/json' +
            '?latlng=:pos' +
            '&language=en' +
            '&sensor=false'
    , {

    });


    $scope.getAddressOfVenue =(function() {
        var cachedValue = {};
        return function(venue) {
            if (!cachedValue[venue.id]) {
                if (venue.location.city) {
                    cachedValue[venue.id] = (venue.location.address?(venue.location.address + ', '):'') +
                        (venue.location.city?(venue.location.city + ', '):'') +
                        (venue.location.country?venue.location.country:'');
                } else {
                    cachedValue[venue.id] = GoogleReverseGeocoding.get({pos: venue.location.lat + ',' + venue.location.lng})
                        .$promise.then(function(resource) {
                            if (resource.results.length <= 0) {
                                return 'unknown';
                            }

                            cachedValue[venue.id] = resource.results[0].formatted_address;
                            return cachedValue[venue.id];
                        });
                }
            }
            return cachedValue[venue.id];
        };
    })();

    $scope.$on('selectVenue', function(e, id) {
        //$location.hash(id);
        var elm = document.querySelector('#' + 'venue-' + id),
            box = elm.getBoundingClientRect(),
            pos = box.top + window.scrollY - 250;
        //window.scrollTo(0, pos);
        scrollToAnimation(pos);
    });

    var previousScroll = {};

    function scrollToAnimation(pos) {
        var scrollIteration = buildScrollIteration(pos);
        requestAnimFrame(scrollIteration);
        previousScroll.inProgress = false;
        previousScroll = scrollIteration;
    }

    window.addEventListener('scroll', function() {
        if (lastSetScrollY !== window.scrollY) {
            previousScroll.inProgress = false;
        }
    });

    var lastSetScrollY;

    function buildScrollIteration(pos) {
        if (pos < 0) {
            pos = 0;
        }
        var iteration = function() {
            var delta = window.scrollY - pos,
                step = 10;

            if (-step < delta && delta < step || !iteration.inProgress) {
                lastSetScrollY = Math.round(pos);
            } else {
                lastSetScrollY = Math.round(window.scrollY - delta/step);
                requestAnimFrame(iteration);
            }
            window.scrollTo(0, lastSetScrollY);
        };

        iteration.inProgress = true;

        return iteration;
    }

    $scope.$on('selectMarkerOnMap', function(e, id) {
        var path = 'venue/' + id;
        $location.path(path);
    });
}]);

if (Hammer.plugins.fakeMultitouch) {
    Hammer.plugins.fakeMultitouch();
}

if (Hammer.plugins.showTouches) {
    Hammer.plugins.showTouches();
}

/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

angular.module('Carousel', []).directive('carousel', ['$window', '$timeout',
    function ($window, $timeout) {
        'use strict';

        var scrolledLeft = [],
            scrolledRight = [],
            scrollSpeed = 8;

        function startScrollLeft(elm) {
            if (scrolledLeft.indexOf(elm) >= 0) {
                return;
            }
            scrolledLeft.push(elm);
        }

        function stopScrollLeft(elm) {
            var index = scrolledLeft.indexOf(elm);
            scrolledLeft.splice(index, 1);
        }

        function startScrollRight(elm) {
            if (scrolledRight.indexOf(elm) >= 0) {
                return;
            }
            scrolledRight.push(elm);
        }

        function stopScrollRight(elm) {
            var index = scrolledRight.indexOf(elm);
            scrolledRight.splice(index, 1);
        }

        (function updateScroll() {
            var i, count;

            for(i = 0, count = scrolledLeft.length; i < count; i++) {
                scrolledLeft[i].scrollLeft -= scrollSpeed;
            }

            for(i = 0, count = scrolledRight.length; i < count; i++) {
                scrolledRight[i].scrollLeft += scrollSpeed;
            }

            requestAnimFrame(updateScroll);
        })();

        return {
            replace: true,
            restrict: 'E',
            template:       '<div style="position: relative">'+
                            '<a href ng-mousedown="startGoLeft()" ng-mouseup="stopGoLeft()"><div class="carousel-left-arrow" ng-show="useScrollButtons">' +
                                '<span class="glyphicon glyphicon-chevron-left"></span>' +
                            '</div></a>' +
                            '<div class="photos-preview-carousel">' +
                                '<div class="photos-preview-carousel-collection" ng-controller="PhotosPreviewCarouselCtrl">' +
                                    '<div ng-repeat="venueImage in images" class="photo-border">' +
                                        '<div ng-style="getDivStyleFor4SQImg(venueImage, 100, 100)" class="photo-small-preview">' +
                                            '<div class="actions">' +
//                                                '<a href="#!" class="btn btn-primary btn-small"> <span class="glyphicon glyphicon-star"></span></a>' +
                                                '<a href="#!/photos/{{ venue.id }}/{{ venueImage.id }}" class="btn btn-primary btn-small"> <span class="glyphicon glyphicon-zoom-in"></span></a>' +
                                            '</div>'+
                                        '</div>'+
                                    '</div>'+
                                '</div>'+
                            '</div>'+
                            '<a href ng-mousedown="startGoRight()" ng-mouseup="stopGoRight()"><div class="carousel-right-arrow" ng-show="useScrollButtons">' +
                                '<span class="glyphicon glyphicon-chevron-right"></span>' +
                            '</div></a>'+
                            '</div>'
            ,
            link: function (scope, elm, attrs) {
                scope.venue = scope.$eval(attrs.venue);
                var photos = scope.$eval(attrs.data);
                photos.then(function(result) {
                    //FIXME: result is undefined ?
                    scope.useScrollButtons = false;
                    scope.images = result;//scope.$eval(attrs.data);
                    scope.elementWidth = 0;

                    $timeout(function() {
                        if (scope.images.length <= 0) {
                            return;
                        }

                        var container = elm[0].children[1].children[0],
                            childElement = elm[0].children[1].children[0].children[0];

                        var availableWidth = elm[0].children[1].clientWidth,
                            marginWidth = 3,//TODO: calc margin width!
                            elementWidth = childElement.clientWidth + 2 * marginWidth,
                            needWidth = scope.images.length * elementWidth;

                        if (needWidth > availableWidth) {
                            //need scroll buttons
                            scope.useScrollButtons = true;
                        } else {
                            //don't need scroll buttons
                            scope.useScrollButtons = false;
                        }

                        container.style.width = needWidth + 'px';

                        scope.elementWidth = elementWidth;
                        scope.scrollContainer = elm[0].children[1];
                    }, 0);

                    scope.startGoLeft = function() {
                        startScrollLeft(scope.scrollContainer);
                    };

                    scope.stopGoLeft = function() {
                        stopScrollLeft(scope.scrollContainer);
                    };

                    scope.startGoRight = function() {
                        startScrollRight(scope.scrollContainer);
                    };

                    scope.stopGoRight = function() {
                        stopScrollRight(scope.scrollContainer);
                    };
                });
            }
        }
    }]);
var FourSquareModule = angular.module('FourSquare', []);

FourSquareModule.factory('FourSquareClient', function() {
    function dateToYMD(date) {
        var d = date.getDate();
        var m = date.getMonth() + 1;
        var y = date.getFullYear();
        return '' + y + (m<=9 ? '0' + m : m) + (d <= 9 ? '0' + d : d);
    }

    return {
        currentAPIDate: dateToYMD(new Date()),
        CLIENT_ID: null,
        CLIENT_SECRET: null
    }
});
/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

FourSquareModule.factory('FourSquarePhotos', ['FourSquareClient', 'VenuesAPI', '$q', '$resource', '$rootScope', '$timeout', function(FourSquareClient, VenuesAPI, $q, $resource, $rootScope, $timeout) {
        'use strict';

        var api = {},
            isUserLogin = false;

        var Photo = $resource('https://api.foursquare.com/v2/photos/:photoId' +
            '?client_id=:clientId' +
            '&client_secret=:clientSecret' +
            '&v=' + FourSquareClient.currentAPIDate, {
                clientId: FourSquareClient.CLIENT_ID,
                clientSecret: FourSquareClient.CLIENT_SECRET
            });


        api.getPhotoUrlById = function(venueId, photoId, width, height) {
            var photo = VenuesAPI.getPhotoById(photoId);
            if (photo) {
                return $q.when(concat4SQImg(photo, width, height));
            }

            if (isUserLogin) {
                return Photo.get({
                    photoId: id
                }).$promise.then(function(resource) {
                    return concat4SQImg(resource.response.photo, width, height);
                }, function(error) {
                    console.log('error', error);
                });
            } else {
                return VenuesAPI.getPhotosByVenueId(venueId).then(function(result) {
                    for(var i = 0, count = result.length; i < count; i++) {
                        var photo = result[i];
                        if (photo.id === photoId) {
                            return concat4SQImg(photo, width, height);
                        }
                    }

                    return null;
                });
            }
        };

        function concat4SQImg(icon, width, height) {
            if (!icon || !icon.prefix || !icon.suffix) {
                return '';
            }
            var prefix = icon.prefix.substr(0, icon.prefix.length - 1),
                middle = '',
                suffix = icon.suffix;

            if (width && height) {
                middle = '/' + width + 'x' + height;
            } else {
                middle = '/original';
            }

            return prefix + middle + suffix;
        }

        return api;
    }]);
angular.module('Location', []).factory('Location', ['SmartIP', '$q', '$rootScope', '$location', 'DEF_ZOOM', function(SmartIP, $q, $rootScope, $location, DEF_ZOOM) {
   'use strict';
    var api = {},
        loc;

    /**
     * get current user geolocation
     *
     * @returns {Promise}
     */
    api.getLocation = function() {
        if (loc) {
            return $q.when(loc);
        } else {
            return api.requestMyLocation();
        }
    };

    /**
     * request my location by smartip and fallback to location by GPS
     *
     * @returns {Promise}
     */
    api.requestMyLocation = function() {
        return SmartIP.getUserLocation().then(function(loc) {
            api.setLocation(loc.lat, loc.lng);
            return loc;
        }, function(error) {
            console.log(error);
            return api.requestLocationFromGPS().then(function(pos) {
                var c = pos.coords;

                return {
                    lat: c.latitude,
                    lng: c.longitude
                };
            });
        });
    };

    /**
     * request location through GPS
     *
     * @return {*}
     */
    api.requestLocationFromGPS = (function() {
        return function () {
            var defer = $q.defer();

            navigator.geolocation.getCurrentPosition(function (pos) {
                var c = pos.coords;

                api.setLocation(c.latitude, c.longitude);
                defer.resolve(pos);
                $rootScope.$digest();
            }, function(error) {
                console.log(error);
                defer.reject(error);
            });

            return defer.promise;
        }
    })();

    /**
     * update current user geolocation
     *
     * @param {number} lat
     * @param {number} lng
     * @param {number} [zoom]
     */
    api.setLocation = function(lat, lng, zoom) {
        loc = loc || {};
        zoom = Number(zoom || loc.zoom || DEF_ZOOM);

        if (loc.lat === lat
            && loc.lng === lng
            && loc.zoom === zoom) {
            return;
        }

        loc.lat = Number(lat);
        loc.lng = Number(lng);

        loc.zoom = zoom;

        $rootScope.$emit('updateUserLocation', loc);

        $location.path('location/' + zoom + '/' + lat + '/' + lng);
        $location.replace();
    };

    return api;
}]);
/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

digiletme.controller('MapCtrl', ['VenuesAPI', 'Location', '$scope', '$rootScope', '$timeout', '$q', 'DEF_ZOOM', function(VenuesAPI, LocationService, $scope, $rootScope, $timeout, $q, DEF_ZOOM) {
    'use strict';

    $scope.center = {
    };

    $scope.markers = {};

    var needInitialize = false;

    $scope.events = {
        dblclick: function(e){
            console.log(e);
        },
        click: function(e) {
            console.log(e);
        },
        zoomend: function(e) {
            lazyUpdateBounds(e.target.getBounds().getSouthWest(), e.target.getBounds().getNorthEast());
            LocationService.setLocation($scope.center.lat, $scope.center.lng, $scope.center.zoom);
        },
        dragend: function(e) {
            lazyUpdateBounds(e.target.getBounds().getSouthWest(), e.target.getBounds().getNorthEast());
            LocationService.setLocation($scope.center.lat, $scope.center.lng, $scope.center.zoom);
        },
        moveend: function(e) {
            if (needInitialize) {
                var sw = e.target.getBounds().getSouthWest(),
                    ne = e.target.getBounds().getNorthEast();
                lazyUpdateBounds(sw, ne);
                LocationService.setLocation(0.5 * (sw.lat + ne.lat), 0.5 * (sw.lng + ne.lng), $scope.center.zoom);

                needInitialize = false;
            }
        }
    };

    $scope.$on('leafletDirectiveMarkersClick', function(e, id) {
        var marker = $scope.markers[id];
        $rootScope.$broadcast('selectMarkerOnMap', id);
        beforeFocusOnMarker(marker);
        afterFocusOnMarker(marker);
    });

    var previousFocusedMarker = null;

    function beforeFocusOnMarker(marker) {
        if (previousFocusedMarker === marker) {
            return false;
        }

        if (!previousFocusedMarker) {
            return true;
        }

        previousFocusedMarker.focus = false;
        return true;
    }

    function afterFocusOnMarker(marker) {
        previousFocusedMarker = marker;
    }

    $rootScope.$on('selectVenue', function(e, id) {
        var marker = $scope.markers[id];
        if(!marker || !beforeFocusOnMarker(marker)) {
            return;
        }
        marker.focus = true;
        previousFocusedMarker = marker;
        afterFocusOnMarker(marker);
    });

    $rootScope.$on('updateBounds', function (e, value) {
        requestVenues();
    });

    $rootScope.$on('showVenue', function(e, venue) {
        if ($scope.markers[venue.id]) {
            return;
        }

        $scope.markers[venue.id] = {
            lat: venue.location.lat,
            lng: venue.location.lng,
            message: venue.name
        };
    });

    $rootScope.$on('hideVenue', function(e, venue) {
        if (!$scope.markers[venue.id]) {
            return;
        }

        //TODO: can't use more optimal sentence $scope.markers[venue.id] = null;
        //because of bug in leaflet ng directive
        delete $scope.markers[venue.id];
    });

    /**
     * lazy update bounds. Update only after 2 seconds of lack of other updates
     *
     * @private
     * @param sw
     * @param ne
     */
    var lazyUpdateBounds = (function() {
        var storedSW,
            storedNE,
            timeoutId;

        return function (sw, ne) {
            storedSW = sw;
            storedNE = ne;

            if (timeoutId) {
                $timeout.cancel(timeoutId);
            }

            timeoutId = $timeout(function() {
                VenuesAPI.updateBounds(storedSW, storedNE);
                timeoutId = null;
            }, 2 * 1000)
        }
    })();

    var running = true;

    var destroyHandler = $scope.$on('$destroy', function() {
        console.log('destroy');
        running = false;
    });

    /**
     * @private
     */
    var firstPlaceToCurrentPosition = true;
    function placeToCurrentPosition() {
       return LocationService.getLocation().then(function(loc) {
           if (loc.hasOwnProperty('zoom')) {
               $scope.center.zoom = loc.zoom;
           } else if (firstPlaceToCurrentPosition) {
               firstPlaceToCurrentPosition = false;
               $scope.center.zoom =  DEF_ZOOM;
           }
           $scope.center.lat = loc.lat;
           $scope.center.lng = loc.lng;
           return loc;
        });
    }

    function requestNeighborhood(venue) {
        VenuesAPI.getNextVenuesByVenueId(venue.id).then(function(result) {
            console.log('>');
            console.log('venue.name: ' + venue.name);
            console.log('venue.id: ' + venue.id);
            console.log('adjacency: ', VenuesAPI.getAdjacencyGraphOfVenues(venue.id));
            console.log('next: ', result);
        });
    }

    /**
     * @private
     */
    function requestVenues() {
        $scope.waitForVenuesWithPhotos = true;
        VenuesAPI.getVenuesWithPhotos();
    }

    //setup custom controls
    $scope.myCustomControls = [];

    var MyControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },

        onAdd: function (map) {
            var className = 'leaflet-control-my-location',
                container = L.DomUtil.create('div', className + ' leaflet-bar');

            this._map = map;

            this._zoomInButton = this._createButton(
                '&gt;', 'My Location',  className,  container, this._findLocation,  this);

            /*
             map.on('zoomend', this._updateDisabled, this);*/

            return container;
        },

        _findLocation: function(e) {
            LocationService.requestMyLocation().then(function(loc) {
                $scope.center.lat = loc.lat;
                $scope.center.lng = loc.lng;
                $scope.center.zoom = loc.zoom;
            });
        },

        _createButton: function (html, title, className, container, fn, context) {
            var link = L.DomUtil.create('a', className, container);
            link.innerHTML = html;
            link.href = '#';
            link.title = title;

            var stop = L.DomEvent.stopPropagation;

            L.DomEvent
                .on(link, 'click', stop)
                .on(link, 'mousedown', stop)
                .on(link, 'dblclick', stop)
                .on(link, 'click', L.DomEvent.preventDefault)
                .on(link, 'click', fn, context);

            return link;
        },

        _updateDisabled: function () {
            var map = this._map,
                className = 'leaflet-control-zoom-disabled';

            L.DomUtil.removeClass(this._zoomInButton, className);
            L.DomUtil.removeClass(this._zoomOutButton, className);

            if (map._zoom === map.getMinZoom()) {
                L.DomUtil.addClass(this._zoomOutButton, className);
            }
            if (map._zoom === map.getMaxZoom()) {
                L.DomUtil.addClass(this._zoomInButton, className);
            }
        }
    });

    $scope.myCustomControls.push(MyControl);


    function init() {
        placeToCurrentPosition().then(function(loc) {
            needInitialize = true;
            //just use the hack with zomming to trigger zoomend event
            /*$scope.center.zoom = loc.zoom - 1;
            $timeout(function() {
                $scope.center.zoom++;
            });*/
        });
        requestVenues();
    }

    //give sometime for router to get url and transfer it to location
    $timeout(init, 500);
}]);
/**
 * Project: digital-me.
 * Copyright (c) 2013, Eugene-Krevenets
 */

digiletme.controller('PhotoCtrl', ['VenuesAPI', 'FourSquarePhotos', '$scope', '$routeParams', '$location', '$timeout', function(VenuesAPI, FourSquarePhotos, $scope, $routeParams, $location, $timeout) {
    'use strict';
    var x = 0,
        y = 0,
        startX = 0,
        startY = 0,
        newX = 0,
        newY = 0,
        scale = 1,
        deltaX = 0,
        deltaY = 0,
        imageCenterX = 0,
        imageCenterY = 0,
        image = new Image(),
        backgroundColor = '#222';

    //$scope.url = VenuesAPI.getPhotoUrlById($routeParams.photoId);
    FourSquarePhotos.getPhotoUrlById($routeParams.venueId, $routeParams.photoId).then(function(url) {

        $scope.url = url;

        if ($scope.url === '') {
            $location.path('');
        }

        $scope.close = function() {
            $location.path('');
        };

        $scope.onTapImage = function(e) {
            $scope.close();
        };

        $scope.onDragImageStart = function(e) {
            e.gesture.preventDefault();
            startX = x;
            newX = x;
            startY = y;
            newY = y;
        };

        $scope.onDragImage = function(e) {
            e.gesture.preventDefault();

            if (window.innerWidth < image.width * scale) {
                newX = clamp(startX + e.gesture.deltaX, window.innerWidth - image.width - (imageCenterX - image.width) *  (1 - scale), (imageCenterX - image.width) *  (1 - scale));
            }

            if (window.innerHeight < image.height * scale) {
                newY = clamp(startY + e.gesture.deltaY, window.innerHeight - image.height - (imageCenterY - image.height) *  (1 - scale), (imageCenterY - image.height) *  (1 - scale));
            }

            setPosition(newX, newY, scale);
        };

        $scope.onDragImageEnd = function(e) {
            e.gesture.preventDefault();
            x = newX;
            y = newY;
        };

        $scope.onTransformStart = function(e) {
            deltaX = imageCenterX - e.gesture.center.pageX + x;
            deltaY = imageCenterY - e.gesture.center.pageY + y;
        };

        $scope.onTransform = function(e) {
            var localScale = scale * e.gesture.scale,
                deltaScale = e.gesture.scale - 1;
            setPosition(x + deltaX * deltaScale, y + deltaY * deltaScale, localScale);
            e.gesture.preventDefault();
        };

        $scope.onTransformEnd = function(e) {
            var localScale = scale * e.gesture.scale,
                deltaScale = e.gesture.scale - 1;
            scale = localScale;
            x = x + deltaX * deltaScale;
            y = y + deltaY * deltaScale;
            setPosition(x, y, scale);
        };

        $scope.onMouseDown = function($event) {
            $event.preventDefault();
            return false;
        };

        //http://loadinfo.net/
        $scope.imageBgStyle = {
            width: '100%',
            height: '100%',
            background: backgroundColor + ' url("img/loading.gif") no-repeat',
            backgroundPosition: 'center center'
        };

        image.src = $scope.url;
        image.onload = function() {
            imageCenterX = 0.5 * image.width;
            imageCenterY = 0.5 * image.height;
            x = 0.5 * (window.innerWidth - image.width);
            y = 0.5 * (window.innerHeight - image.height);
            $scope.$apply(function() {
                $scope.imageBgStyle = {
                    cursor: 'move',
                    width: '100%',
                    height: '100%',
                    background: backgroundColor + ' no-repeat'
                    //background: backgroundColor + ' url("' + $scope.url + '") no-repeat'
                    //backgroundPosition: 'center center'
                };

                $scope.imageSrc = $scope.url;

                setPosition(x, y, scale);
            });
        };

        var getImageView = (function() {
            var imageView = document.querySelector('#imageView');
            return function() {
                if (imageView) {
                    return imageView;
                }
                imageView = document.querySelector('#imageView');
                return imageView;
            }
        })();

        function setPosition(x, y, scale) {
            /*$scope.imageStyle = {
                left: x + 'px',
                top: y + 'px'
            };*/


            if (getImageView()) {
                var transform = 'rotateZ(0) translateX(' + ~~x + 'px) translateY(' + ~~y + 'px) scale(' + scale + ')';
                getImageView().style.webkitTransform = transform;
            }
        }

        /*function updatePosition() {
            var t = 0.001 * Date.now();
            setPosition(100*Math.cos(t), 100*Math.sin(t))
            $timeout(updatePosition, 1000/60);
        }

        updatePosition();*/

        function clamp(value, min, max) {
            if (value < min) {
                return min;
            } else if (value > max) {
                return max;
            } else {
                return value;
            }
        }
    });
}]);
/**
 * Provides requestAnimationFrame in a cross browser way.
 */
window.requestAnimFrame = (function() {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
            window.setTimeout(callback, 1000/60);
        };
})();
angular.module('SmartIP', [])
    .factory('SmartIP', ['$http', '$q', '$resource', '$rootScope', '$timeout', function($http, $q, $resource, $rootScope, $timeout) {
        'use strict';

        var api = {},
            userSmartIP = false;

        api.getUserInfo = function() {
            return $http.jsonp('http://smart-ip.net/geoip-json/?callback=JSON_CALLBACK').then(function(responce, status, headers, config) {
                // this callback will be called asynchronously
                // when the response is available
                return responce.data;
            });
        };

        /**
         * request user IP
         * @returns {*}
         */
        api.getUserIP = function() {
            return $http.jsonp('http://jsonip.appspot.com/?callback=JSON_CALLBACK')
                .then(function(responce, status, headers, config) {
                    return responce.data;
                });
        };

        /**
         * get location info by ip
         * @param ip
         */
        api.getLocationInfoByIP = function(ip) {
            return $http.jsonp('http://www.geoplugin.net/json.gp?ip=' + ip + '&jsoncallback=JSON_CALLBACK')
                .then(function(responce, status, headers, config) {
                    return responce.data;
                });
        };

        /**
         * get user location object {lat, lng}
         *
         * @returns {Promise}
         */
        api.getUserLocation = function() {
            if (userSmartIP) {
                return api.getUserInfo().then(function(info) {
                    return {
                        lat: Number(info.latitude),
                        lng: Number(info.longitude)
                    }
                });
            } else {
                return api.getUserIP()
                    .then(function(response) {
                        return api.getLocationInfoByIP(response.ip);
                    }).then(function(response) {
                        return {
                            lat: Number(response.geoplugin_latitude),
                            lng: Number(response.geoplugin_longitude)
                        }
                    });
            }
        };

        return api;
    }]);
digiletme.controller('StatisticsCtrl', ['VenuesAPI', '$scope', '$rootScope', function(VenuesAPI, $scope, $rootScope) {
    'use strict';
    $rootScope.$on('changeNumOfRequest', function(e, numOfRequest) {
        $scope.numOfRequest = numOfRequest;
    })
}]);


FourSquareModule.factory('VenuesAPI', ['FourSquareClient', '$q', '$resource', '$rootScope', '$timeout', function(FourSquareClient, $q, $resource, $rootScope, $timeout) {
        'use strict';

        var api = {},
            bounds/* = {

                London
                sw: {
                    lat: 51.505 - 0.5,
                    lng: -0.09 - 0.5
                },
                ne: {
                    lat: 51.505 + 0.5,
                    lng: -0.09 + 0.5
                }
            }*/,
            numOfRequest = 0;

        /**
         * @private
         */
        function incNumOfRequest() {
            numOfRequest++;
            $rootScope.$emit('changeNumOfRequest', numOfRequest);
        }

        /**
         *
         * @param sw
         * @param ne
         */
        api.updateBounds = function(sw, ne) {
            var maxWidth = 2,
                maxHeight = 2;
            bounds = {
                sw: sw,
                ne: ne
            };

            localVenues = null;

            //TODO: Fix Bounding quadrangles with an area up to approximately 10,000 square kilometers are supported.
            if (ne.lat - sw.lat > maxWidth) {
                var latCenter = 0.5 * (ne.lat + sw.lat);
                sw.lat = latCenter - 0.5 * maxWidth;
                ne.lat = latCenter + 0.5 * maxWidth;
            }

            if (ne.lng - sw.lng > maxHeight) {
                var lngCenter = 0.5 * (ne.lng + sw.lng);
                sw.lng = lngCenter - 0.5 * maxHeight;
                ne.lng = lngCenter + 0.5 * maxHeight;
            }

            $rootScope.$emit('updateBounds', bounds);
        };

        function isOutsideTheBounds(point) {
            return point.lat < bounds.sw.lat || bounds.ne.lat < point.lat ||
                   point.lng < bounds.sw.lng || bounds.ne.lng < point.lng;
        }

        /**
         * get visible bounds
         *
         * @returns {*}
         */
        api.getBounds = (function() {
            var defer;
            return function() {
                if (defer) {
                    return defer.promise;
                }
                defer = $q.defer();
                if (bounds) {
                    //hack. it should work without timeout.
                    $timeout(function() {
                        defer.resolve(bounds);
                        defer = null;
                    }, 0);
                } else {
                    var unregisteredListenerFunction = $rootScope.$on('updateBounds', function (e, value) {
                        defer.resolve(value);
                        defer = null;
                        unregisteredListenerFunction();
                    });
                }

                return defer.promise;
            };
        })();

        var catetories = [
//        '4d4b7105d754a06379d81259', //(main) Путешествия и транспорт
//        '4bf58dd8d48988d1ed931735', //Аэропорт / Аэропорт
//        '4e4c9077bd41f78e849722f9', //Велопрокат / Велопрокат
            '4bf58dd8d48988d1fe931735', //Автовокзал / Автовокзал
//        '4e51a0c0bd41d3446defbb2e', //Паром / Паром
//        '4bf58dd8d48988d1f6931735', //Путешествия - Общее / Путешествия ?
//        '4bf58dd8d48988d1fc931735', //Легкорельсовая линия / Легкорельсовая линия
//        '4f2a23984b9023bd5841ed2c', //Подвижный объект / Подвижный объект
//        '4bf58dd8d48988d1ef941735', //Автопрокат / Автопрокат
//        '4bf58dd8d48988d1f9931735', //Дорога / Дорога
//        '4bf58dd8d48988d1fd931735', //Метро / Метро
//        '4bf58dd8d48988d130951735', //Такси / Такси
//        '4f4530164b9074f6e4fb00ff', //Справочный пункт / Справочный пункт
//        '4bf58dd8d48988d129951735', //Железнодорожный вокзал / Железнодорожный вокзал
        ];

        //key: venueId, value is object of venueId that connected
        var adjacencyGraphOfVenues = {};

        api.getAdjacencyGraphOfVenues = function(id) {
            return adjacencyGraphOfVenues[id];
        };

        function inCategories(venue) {
            for (var i = 0, count = venue.categories.length; i < count; i++) {
                if (catetories.indexOf(venue.categories[i]) >= 0) {
                    return true;
                }
            }

            return false;
        }

        var Venues = $resource(
            'https://api.foursquare.com/v2/venues/search' +
            '?ll=:pos' +
            '&intent=browse' +
            '&limit=:limit' +
            '&radius=:radius' +
            '&categoryId=:categories' +
            '&client_id=:clientId' +
            '&client_secret=:clientSecret' +
            '&v=' + FourSquareClient.currentAPIDate, {
                limit: 50,
                radius: 100000,
                clientId: FourSquareClient.CLIENT_ID,
                clientSecret: FourSquareClient.CLIENT_SECRET
            }
        );

        var VenuesByQuadrangle = $resource(
            'https://api.foursquare.com/v2/venues/search' +
                '?sw=:sw' +
                '&ne=:ne' +
                '&intent=browse' +
                '&limit=:limit' +
                '&categoryId=:categories' +
                '&client_id=:clientId' +
                '&client_secret=:clientSecret' +
                '&v=' + FourSquareClient.currentAPIDate, {
                limit: 50,
                clientId: FourSquareClient.CLIENT_ID,
                clientSecret: FourSquareClient.CLIENT_SECRET
            }
        );

        var localVenues = null,
            venuesWithPhotos = {},
            venuesWithoutPhotos = {},
            visibleVenues = {},
            visibleVenuesWithoutPhotos = {};

        api.getLocalVenues = function() {
            if (!localVenues) {
                localVenues = api.getBounds()
                    .then(function(bounds) {
                        incNumOfRequest();
                        return VenuesByQuadrangle.get({
                            sw: bounds.sw.lat + ', ' + bounds.sw.lng,
                            ne: bounds.ne.lat + ', ' + bounds.ne.lng,
                            categories: catetories.join(','),
                            clientId: FourSquareClient.CLIENT_ID,
                            clientSecret: FourSquareClient.CLIENT_SECRET
                        }).$promise;
                    });
            }

            return localVenues;
        };

        /**
         * return venues that have photos
         *
         * @returns {Promise}
         */
        api.getVenuesWithPhotos = function() {
            return api.getLocalVenues().then(function(resource) {
                var venues = resource.response.venues;

                //FIXME: each time we get new venues with the same ids
                //so stored venues in lists (venuesWithPhotos, venuesWithoutPhotos,visibleVenues)
                //can be different

                hideInvisibleVenues(visibleVenues, hideVenue);
                hideInvisibleVenues(visibleVenuesWithoutPhotos, hideVenueWithoutPhoto);

                var chainOfRequests = $q.when({});

                for(var i = 0, count = venues.length; i < count; i++) {
                    var venue = venues[i];
                    chainOfRequests = chainOfRequests
                        .then(buildRequest(venue))
                        .then(buildHandler(venue));
                }

                function buildRequest(venue) {
                    return function() {
                        return getPhotosOfVenue(venue);
                    }
                }

                function buildHandler(venue) {
                    return function(photos) {
                        if (photos.length > 0) {
                            venuesWithPhotos[venue.id] = venue;
                            showVenue(venue);
                            $rootScope.$emit('newVenueWithPhotos', venue);
                        } else {
                            venuesWithoutPhotos[venue.id] = venue;
                            showVenueWithoutPhoto(venue);
                            $rootScope.$emit('newVenueWithoutPhotos', venue);
                        }

                        return venuesWithPhotos;
                    };
                }

                return chainOfRequests.then(function(venuesWithPhotos) {
                    /*hideInvisibleVenues(visibleVenues, hideVenue);
                    hideInvisibleVenues(visibleVenuesWithoutPhotos, hideVenueWithoutPhoto);*/
                    return venuesWithPhotos;
                });
            }, function(err) {
                switch(err.data.meta.errorType) {
                    case 'geocode_too_big':
                        //TODO : reduce bounds
                        /*api.updateBounds({

                        });*/
                        break;
                    default:
                        console.log('need to add handler to error', err);
                        break;
                }

                return [];
            });
        };

        /**
         * @private
         * @param venues
         */
        function hideInvisibleVenues(venues, hideCallback) {
            var ids = Object.keys(venues);
            ids.forEach(function(id) {
                var venue = venues[id];
                if (isVenueInvisible(venue)) {
                    hideCallback(venue)
                }
            });
        }

        /**
         * @private
         *
         * @param venue
         */
        function showVenue(venue) {
            if (visibleVenues[venue.id]) {
                return;
            }
            visibleVenues[venue.id] = venue;
            $rootScope.$emit('showVenue', venue);
        }

        /**
         * @private
         * @param venue
         */
        function hideVenue(venue) {
            if (!visibleVenues[venue.id]) {
                return;
            }
            visibleVenues[venue.id] = null;
            $rootScope.$emit('hideVenue', venue);
        }

        /**
         * @private
         * @param venue
         */
        function showVenueWithoutPhoto(venue) {
            if (visibleVenuesWithoutPhotos[venue.id]) {
                return;
            }
            visibleVenuesWithoutPhotos[venue.id] = venue;
            $rootScope.$emit('showVenueWithoutPhoto', venue);
        }

        /**
         * @private
         * @param venue
         */
        function hideVenueWithoutPhoto(venue) {
            if (!visibleVenuesWithoutPhotos[venue.id]) {
                return;
            }
            visibleVenuesWithoutPhotos[venue.id] = null;
            $rootScope.$emit('hideVenueWithoutPhoto', venue);
        }

        /**
         * @private
         * @param venue
         * @returns {*}
         */
        function isVenueInvisible(venue) {
            if (!venue) {
                return false;
            }

            return isOutsideTheBounds(venue.location);
        }

        /**
         * @private
         */
        var getPhotosOfVenue = (function() {
            var cachedRequest = {},
                cachedValue = {};
            return function(venue) {
                if (cachedValue[venue.id]) {
                    return $q.when(cachedValue[venue.id]);
                }

                if (!cachedRequest[venue.id]) {
                    cachedRequest[venue.id] = api.getPhotosByVenueId(venue.id)
                        .then(function(result) {
                            cachedRequest[venue.id] = null;
                            cachedValue[venue.id] = result;
                            return result;
                        });
                }

                return cachedRequest[venue.id];
            };
        })();

        var mapPhotoIdToInstance = {};

        var Venue = $resource('https://api.foursquare.com/v2/venues/:venueId' +
            '?client_id=:clientId' +
            '&client_secret=:clientSecret' +
            '&v=' + FourSquareClient.currentAPIDate);

        /**
         * @private
         */
        var getVenueById = (function() {
            var cachedVenue = {};
            return function(id) {
                if (!cachedVenue[id]) {
                    incNumOfRequest();
                    cachedVenue[id] = Venue.get({
                        venueId: id,
                        clientId: FourSquareClient.CLIENT_ID,
                        clientSecret: FourSquareClient.CLIENT_SECRET
                    }).$promise;
                }

                return cachedVenue[id];
            };
        })();

        var Photos = $resource('https://api.foursquare.com/v2/venues/:venueId/photos' +
            '?client_id=:clientId' +
            '&client_secret=:clientSecret' +
            '&v=' + FourSquareClient.currentAPIDate);

        api.getPhotosByVenueId = (function() {
            var cachedValues = {};
            return function(id) {
                if (!cachedValues[id]) {
                    incNumOfRequest();
                    cachedValues[id] = Photos.get({
                            venueId:id,
                            clientId: FourSquareClient.CLIENT_ID,
                            clientSecret: FourSquareClient.CLIENT_SECRET
                        })
                        .$promise.then(function(resource) {
                            var photos = [],
                                items = resource.response.photos.items;
                            for(var j = 0, jCount = items.length; j < jCount; j++) {
                                var item = items[j];
                                photos.push(item);
                                mapPhotoIdToInstance[item.id] = item;
                            }
                            return photos;
                        });
                }

                return cachedValues[id];
            }
        })();

        var NextVenues = $resource('https://api.foursquare.com/v2/venues/:venueId/nextvenues' +
            '?client_id=:clientId' +
            '&client_secret=:clientSecret' +
            '&v=' + FourSquareClient.currentAPIDate);

        api.getNextVenuesByVenueId = (function() {
            var cachedValues = {};

            return function(id) {
                if (!cachedValues[id]) {
                    adjacencyGraphOfVenues[id] = {
                        neighborhood: {}
                    };

                    var iterator = buildNextVenueIterator(id, []);
                    return iterator(id, 8, iterator);
                }

                return cachedValues[id];
            };

            function buildNextVenueIterator(rootId, neighborhood) {
                var cachedValues = {};
                return function(currentId, depth, iterator) {
                    if (!cachedValues[currentId]) {
                        incNumOfRequest();
                        cachedValues[currentId] = NextVenues.get({
                            venueId: currentId,
                            clientId: FourSquareClient.CLIENT_ID,
                            clientSecret: FourSquareClient.CLIENT_SECRET
                        })
                        .$promise.then(function(nextVenues) {
                            var items = nextVenues.data.response.nextVenues.items,
                                result = $q.when(neighborhood);

                            for(var i = 0, count = items.length; i < count; i++) {
                                var item = items[i];
                                if (inCategories(item)) {
                                    result = result.then(function() {
                                        neighborhood.push(item);
                                        adjacencyGraphOfVenues[rootId][item.id] = {
                                            item: item
                                        };
                                        return neighborhood;
                                    });
                                } else {
                                    if (depth > 0 && !adjacencyGraphOfVenues[rootId].neighborhood[item.id]) {
                                        adjacencyGraphOfVenues[rootId].neighborhood[item.id] = {
                                            item: item,
                                            depth: depth
                                        };
                                        result = result.then(function() {
                                            return iterator(item.id, depth - 1, iterator);
                                        });
                                    }
                                }
                            }

                            return result;
                        });
                    }

                    return cachedValues[currentId];
                }
            }
        })();

        api.getPhotoById = function(id) {
            return mapPhotoIdToInstance[id];
        };


        return api;
    }]);