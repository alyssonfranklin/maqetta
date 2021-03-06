define(["dojo/_base/declare", "davinci/ui/TextEditor"], function(declare, TextEditor) {

return declare("davinci.ui.ModelEditor", TextEditor, {

    constructor: function (element) {

		this.subscribe("/davinci/ui/selectionChanged", this.selectModel);
	},
	
	colorize: function (text) {
	    return null;
	},
	
	setContent: function (filename, content) {
		this.inherited(arguments);
		this.model.fileName = filename;
		this.model.setText(content);
	},
		
    getHoverText: function(x,y) {
		var lineColPos = this.convertMouseToLine(x,y);
		var childModel = this.model.findChildAtPosition(
				{startOffset:lineColPos.row,endOffset:lineColPos.col});
		return childModel.getLabel();
	},
	
	handleChange: function(text) {
        this.inherited(arguments);
        
        this.model.setText(text);
        
        var changeEvent = {
                newModel: this.model
        };
        dojo.publish("/davinci/ui/modelChanged", [changeEvent]);
	},
	
	selectModel: function (selection, editor) {
		if (this.publishingSelect || (editor && this != editor)) {
			return;
		}
		
        if (selection.length && selection[0].model) {
			var model=selection[0].model;
			if (model.elementType) {
			    var sobj = this.model.mapPositions(model);
				this.select(sobj);
			}
		}
	},

	selectionChange: function (selection) {
       var childModel = this.model.findChildAtPosition(selection);
       selection.model = childModel;
       if (childModel != this._selectedModel) {
           this.publishingSelect = true;
           dojo.publish("/davinci/ui/selectionChanged", [[selection], this]);
           this.publishingSelect = false;
       }
       this._selectedModel = childModel;
	},

	getSyntaxPositions: function (text,lineNumber) {
		
		this.model.setText(text);
		
		if (this.model.getSyntaxPositions) {
			var positions = this.model.getSyntaxPositions(lineNumber);
		
			function sortPositions(a,b) {
				if (a.line != b.line) {
					return a.line-b.line;
				}
				return a.col-b.col;
			}
			positions = positions.sort(sortPositions);
			return positions;
		}
	},
	
	save: function () {
		this.model.setText(this.getText());
		this.inherited(arguments);
	},
	
	getErrors: function () {
	    return this.model.errors || []; // return empty array to be kind to iterators.
	}
});
});
