define([
        "dojo/_base/declare",
        "dojo/_base/connect",
        "davinci/maqetta/States",
        "./commands/EventCommand",
        "./commands/StyleCommand"
], function(declare, connect, maqettaStates, EventCommand, StyleCommand){

var veStates = declare(maqettaStates, {
	
	_update: function(widget, newState, oldState) {
		this.inherited(arguments);
		
		widget = this._getWidget(widget);
		if (!widget) {
			return;
		}

		var styleArray = this.getStyle(widget, newState);

		if (this.isNormalState(newState)) {
			this._styleChange(widget, styleArray);
		}
	},
		
	_updateEvents: function(widget, state, name) {
		var events = ["onclick", "onmouseover", "onmouseout", "onfocus", "onblur"];
		var properties;
		for(var i in events){
			var event = events[i];
			var value = widget && widget.properties && widget.properties[event];
			if (typeof value == "string" && value.indexOf("davinci.states.setState") >= 0) {
				var original = value;
				value = value.replace("'" + state + "'", "'" + name + "'");
				if (value !== original) {
					properties = properties || {};
					properties[event] = value;
				}
			}
		}
		
		var context = this.getContext();
		if (context) {
			var command = new EventCommand(widget, properties);
			context.getCommandStack().execute(command);
		}
	},
	
	_styleChange: function (widget, styleArray){
		var currentEditor = top.davinci.Runtime.currentEditor; //TODO: use require?
		var context = currentEditor.getContext();

		var command = new StyleCommand(widget, styleArray);	
		
		context.getCommandStack().execute(command);
	},
	
	normalize: function(type, widget, name, value) {
        switch(type) {
		    case "style":
	            var state = davinci.ve.states.getState();
	            if (state) {
	                var normalValueArray = this.getStyle(widget, undefined, name);
	                if (normalValueArray) {
		                for(var i=0; i<normalValueArray.length; i++){
		                	if(normalValueArray[i][name]){
		                		value = normalValueArray[i][name];
		                	}
		                }
	                }
	            }
	            break;
        }
        return value;
	},
	
	normalizeArray: function(type, widget, name, valueArray) {
        switch(type) {
		    case "style":
	            var state = davinci.ve.states.getState();
	            if (state) {
	                var normalValueArray = this.getStyle(widget, undefined, name);
	                if (normalValueArray) {
	                	// Remove all entries from valueArray that are in normalValueArray
		                for(var i=0; i<normalValueArray.length; i++){
		                	var nItem = normalValueArray[i];
		                	for(var nProp in nItem){	// should be only one property 
		                		for(var j=valueArray.length-1; j>=0; j--){
		                			var vItem = valueArray[j];
		                			for(var vProp in vItem){	// should be only one property
		                				if(vProp == nProp){
		                					valueArray.splice(j, 1);
		                					break;
		                				}
		                			}
		                		}
		                	}
		                }
		                // Append values from normalValueArray
		                valueArray = valueArray.concat(normalValueArray);
	                }
	            }
	            break;
        }
        return valueArray;
	},
	
	getEditor: function() {
		return top.davinci && top.davinci.Runtime && top.davinci.Runtime.currentEditor;
	},
	
	getContext: function() {
		var editor = this.getEditor();
		return editor && (editor.getContext && editor.getContext() || editor.context);
	},
	
	getDocument: function() {
		var context = this.getContext();
		return context && context.getDocument && context.getDocument();
	},

	// returns a shallow copy of the children
	getChildren: function(widget) {
		if (widget && widget.getChildren) {
			return widget.getChildren().slice();
		}
		return [];
	},
	_updateSrcState: function (widget)
	{
		if (widget._srcElement) {
			var str=this.serialize(widget);
			if (str.trim()) {
				widget._srcElement.addAttribute(davinci.states.ATTRIBUTE,str);
			} else {
				widget._srcElement.removeAttribute(davinci.states.ATTRIBUTE);
			}
		}
	},

	_getWidget: function(widget) {
		if (!widget) {
			var doc = this.getDocument();
			widget = doc && doc.body;
		}
		if (widget && widget._dvWidget) {
				return widget._dvWidget;
		}
		return widget;
	},
	

	initialize: function() {
	
		if (!this.subscribed) {
		
			connect.subscribe("/davinci/states/state/changed", dojo.hitch(this, function(e) { 
				var editor = this.getEditor();
				if (!dojo.isObject(e.widget) || !editor || editor.declaredClass != "davinci.ve.PageEditor"){
					return;
				} // ignore if e.widget is not an object (eg '$all') and ignore updates in theme editor

				dojo.publish("/davinci/states/state/changed/start");
				// If rootWidget, then loop through children, else loop starting with this widget.
				var widget = (e.widget == this.getContext().rootWidget) ? e.widget : e.widget.getParent();
				var children = this.getChildren(widget);
				while (children.length) {
					var child = children.shift();
					if (child) {
						if (!this.isContainer(child)) {
							children = children.concat(this.getChildren(child));					
						}
						this._update(child, e.newState, e.oldState);
					}
				}
				dojo.publish("/davinci/states/state/changed/end");

				// Trigger update of the selection box in case the selected widget changed size or moved
				var context = this.getContext();
				if (context) {
					var selection = context.getSelection();
					if (selection && selection.length == 1) {
						context.updateFocus(selection[0]);
					} else if (selection && selection.length > 1) {
						console.warn("States::TODO: Handle multiple selection");
					}
				}
			}));
			
			connect.subscribe("/davinci/states/state/renamed", dojo.hitch(this, function(e) { 
				var editor = this.getEditor();
				if (!editor || editor.declaredClass == "davinci.themeEditor.ThemeEditor") return; // ignore updates in theme editor
				var children = this.getChildren(e.widget);
				while (children.length) {
					var child = children.shift();
					if (child) {
						if (!this.isContainer(child)) {
							children = children.concat(this.getChildren(child));					
						}
						this.rename(child, e.oldName, e.newName, true);
						this._updateEvents(child, e.oldName, e.newName);
					}
				}
				var state = this.getState();
				if (state === e.oldName) {
					this.setState(e.widget, e.newName, false, true);
				}
			}));
			
			connect.subscribe("/davinci/states/state/style/changed", dojo.hitch(this, function(e) { 
				var containerState = this.getState();
				if (containerState == e.state) {
					this._update(e.widget, e.state, containerState);		
				}
			}));
			
			connect.subscribe("/davinci/ui/widget/replaced", dojo.hitch(this, function(newWidget, oldWidget) { 
				var containerState = this.getState();
				if (containerState) {
					this._update(newWidget, containerState, undefined);		
				}
			}));
			
			this.subscribed = true;
		}
	}
});

//TODO: change to use singleton pattern for this module?
davinci.ve.states = new veStates();
davinci.ve.states.initialize();

return davinci.ve.states;
});
