'use strict';

const rootProps = {};
const dbxGetRootProps = () => {
    let rootPropsElem = document.getElementById('__root-props__');
    if (Object.keys(rootProps).length===0 && rootPropsElem) {
        let rootPropsObj = JSON.parse(rootPropsElem.innerText);
        return rootPropsObj ?? undefined;
    }
};
const extIsManagedPage = () => window.location.search.match(/status=bulk/) && window.location.pathname.match(/\/home\/manage/);
const extIsPageLoaded = () => !!extUIGetInsertLocation() /* Function is in ReportButtonUI.js */;
const extUIExists = () => !!document.getElementById('uo-dbx-sign-utils-extension-container');

window.setInterval(function() {
    if(extIsManagedPage() && !extUIExists() && extIsPageLoaded()) {
        Object.assign(rootProps, dbxGetRootProps());
        extUICreate(rootProps);
    }
}, 500);