'use strict';

function htmlElem(elemName, className, attrs={}, text=undefined, child=undefined) { 
    const elem = document.createElement(elemName); 
    elem.className=className; 
    if (child) { 
        if (child instanceof Array) {
            child.forEach(function(childElem) { elem.appendChild(childElem); });
        } else {
            elem.appendChild(child); 
        }
    }
    if(text) { elem.innerText=text; }
    Object.keys(attrs).map((key) => { if(attrs.hasOwnProperty(key)) { elem.setAttribute(key, attrs[key]); }});
    return elem; 
}

function createInput(id, type, placeholder, inputElem=undefined) {
    if (!inputElem) {
        inputElem = htmlElem('INPUT', 'dig-TextInput-input', { type: type, placeholder: placeholder, value: '' });
    }
    inputElem.id = id;
    
    const outerContainer = htmlElem('DIV', 'dig-FormRow dig-FormRow--input', {}, '',
        [
            htmlElem('LABEL', 'dig-FormLabel', {}, placeholder),
            htmlElem('SPAN', 'dig-TextInputContainer dig-TextInputContainer--standard', {}, '',
                htmlElem('DIV', 'dig-TextInput-chips-container', {}, '', 
                    inputElem
                )
            )
        ]
    );
    return [outerContainer, inputElem];
}
