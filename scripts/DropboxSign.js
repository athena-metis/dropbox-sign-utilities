'use strict';

class DropboxSign {

    /**
     * DropboxSign Class Constructor
     * 
     * @param String csrfToken CSRF token for the current session, this is available in rootProps in the HelloSign SPA
     */
    constructor(csrfToken) {
        this._cache = new Cache();
        this._csrfToken = csrfToken;
    }

    /**
     * Simple wrapper for Date.parse
     * 
     * @param String strDate 
     * @returns Date object or null on parser failure
     */
    _stringToDate(strDate) {
        let iDate = Date.parse(strDate);
        return isNaN(iDate) ? null : new Date(iDate);
    }

    /**
     * Converts an object (associative array) to a FormData object
     * 
     * @param Object obj 
     * @returns FormData
     */
    _objectToFormData(obj) {
        const frmData = new FormData();
        Object.keys(obj).map(function(key) {
            if(obj.hasOwnProperty(key)) {
                frmData.append(key, obj[key]);
            }
        });
        return frmData;
    }

    /**
     * Request a CSV report for a given bulk send document specified by GUID
     * 
     * @param String bulkJobGUID 
     * @returns Promise
     */
    getBulkCSVReport(bulkJobGUID) {
        return this._request(
            'https://app.hellosign.com/attachment/downloadCsvCopy/type/bulk/guid/' + bulkJobGUID
            , 'GET'
            , undefined
            , 1
            , false
            , 'raw'
        );
    }

    /**
     * Retrieves the CSV reports for all specified bulk send documents
     * 
     * @param Array docObjects minimum doc object {guid:x, name:x}, also useful is moreInfo:{sentBy:{date:x}}
     * @returns Promise
     */
    getBulkCSVReportsForDocs(docObjects) {
        let reportDownloads=0;
        const self = this;
        const outputReportLines = [];
        return new Promise(function(resolve, reject) {
            docObjects.forEach(function(doc) {
                if (!doc || !doc.guid) return;
                self.getBulkCSVReport(doc.guid).then(
                    csvData => {
                        let parsedLines = parseCSV(csvData);

                        //Inject additional document information into CSV rows
                        parsedLines.forEach((line) => { 
                            line['Document Name'] = doc.name; 
                            line['Sent'] = convertTimestampToReadable(doc.moreInfo?.sentBy?.date);
                            line['Signed Timestamp'] = convertTimestampToReadable(line['Signed Timestamp']);
                        })
                        outputReportLines.push(...parsedLines);

                        if(++reportDownloads===docObjects.length) {
                            resolve(outputReportLines);
                        }
                    }, reason => reject(reason)
                );
            });
        });
    }

    /**
     * Retrieves a mapping from GUID to template title for all templates
     * @returns Promise
     */
    getTemplateIdMap() {
        let self = this;
        const templateMap = {};

        return new Promise(function(resolve, reject) {
            self._requestTemplatesAll().then(function(results) {
                results.forEach(function(result) {
                    templateMap[result.guid] = result.title;
                });
                resolve(templateMap);
            }, reason => reject(reason));
        });
    }

    /**
     * Retrieves all bulk send document details after a given date and where the 
     * document title starts with the specified string.
     * 
     * @param Date updatedAfterDate
     * @param String nameStartsWith 
     * @param Boolean fresh If set to true ignores cached values
     * @returns 
     */
    getBulkSendJobs(updatedAfterDate=undefined, nameStartsWith=undefined, fresh=false) {
        let self = this;
        const oUpdatedAfterDate = updatedAfterDate ? this._stringToDate(updatedAfterDate) : null;
        const iUpdatedAfterTimestamp = oUpdatedAfterDate ? oUpdatedAfterDate.getTime() : 0;
        const lnameStartsWith = nameStartsWith ? nameStartsWith.toLowerCase() : undefined;
        const cacheKey = "getBulkSendJobs::" + iUpdatedAfterTimestamp+'-'+(lnameStartsWith ?? '');
        const cacheVal = this._cache.get(cacheKey);

        return new Promise(function(resolve, reject) {
            if (!fresh && cacheVal) return resolve(cacheVal);

            self._requestBulkJobsAll().then(
                results => {
                    const filteredResults = Array
                        .from(results)
                        .filter(
                            doc => Date.parse(doc.dateUpdated) > iUpdatedAfterTimestamp
                        )
                        .filter(
                            doc => !lnameStartsWith || ("" + doc.name).toLowerCase().indexOf(lnameStartsWith)===0
                        );
                    self._cache.set(cacheKey, filteredResults);
                    resolve(filteredResults);
                },
                reason => {
                    reject(reason);
                }
            );
        })
    }

    _requestBulkJobsAll(iUpdatedAfterTimestamp) {
        return this._requestAll(
            'https://app.hellosign.com/home/manageBulk'
            , 'POST'
            , this._objectToFormData({
                page_num: 1,
                response_format: 'spa',
                filter: 'bulk'
            })
            , results => results.filter(doc => Date.parse(doc.dateUpdated) < iUpdatedAfterTimestamp).length===0
        );
    }

    _requestTemplatesAll() {
        return this._requestAll(
            'https://app.hellosign.com/home/manageSearch?filter=template_or_link&page_num=1&page_size=20&response_format=spa&q='
            , 'POST'
        );
    }

    _request(url, method='GET', body=undefined, page=1, fresh=false, responseType='json') {

        const cacheKey = "_request::" 
            + url 
            + '-' 
            + method 
            + '-' 
            + page 
            + '-' 
            + (
                body 
                && body instanceof FormData 
                ? Array.from(body.keys())
                    .reduce(
                        (existingStr, key) => existingStr + '&' + encodeURIComponent(key) + '=' + encodeURIComponent(body.get(key))
                        , ''
                    ) : ''
            );

        const cacheVal = this._cache.get(cacheKey);
        if (cacheVal && !fresh) {
            return new Promise(function(resolve, reject) {
                resolve(cacheVal);
            });
        }

        //Identify where/if page_num is set
        if(url.match(/[?&]page_num=/)) {
            url = url.replace(/([?&])page_num=[0-9]*($|&)/, '$1page_num=' + page + '$2');
        } else if(
            body
            && (typeof body)==='object'
            && body instanceof FormData
            && body.has('page_num')
        ) {
            body.set('page_num', page);
        }

        return fetch(url, {
            method: method,
            body: body,
            redirect: 'error',
            headers: { 'X-CSRF-Token': this._csrfToken }
        })
        .then(
            response => {
                if (responseType==='json') {
                    const parsedResult = response.json();
                    if (parsedResult) {
                        return parsedResult;
                    } else {
                        throw new Error('Unexpected response from dropbox');
                    }
                } else {
                    return response.text();
                }

            }
            , reason => {
                throw new Error('Error requesting bulk documents, you may not be logged in.' + reason);
            }

        ).then(
            responseData => {
                if (responseType==='json') {
                    if (responseData?.pageResults) { //Paginated response
                        return {
                            page: page,
                            totalPages: responseData.numPages ?? 1,
                            results: responseData.pageResults || responseData
                        };
                    } else {
                        return responseData;
                    }
                } else {
                    return responseData;
                }
            }
        ).then(
            responseData => {    
                this._cache.set(cacheKey, responseData);
                return responseData;
            }
        );
    }

    _requestAll(url, method='GET', body=undefined, continueCallback=undefined) {
        let iMaxPages=1;
        let iBatchEnd=1;
        let iBatchSize=2;
        let iCurrentPage=1;
        let iReceived=0;
        let results = [];
        let self = this;

        return new Promise(function(fResolve, fReject) {
            let promiseTimeout = window.setTimeout(
                () => { fReject('timeout'); }
                , 10000
            );

            let resolve = function(results) {
                window.clearTimeout(promiseTimeout);
                fResolve(results);
            };

            let responseHandler = function(result) {
                iMaxPages = result.totalPages;
                results.push(...result.results);
                ++iReceived;
                if(iReceived===iMaxPages) resolve(results);
                if(iReceived===iBatchEnd) {
                    iBatchEnd=Math.min(iBatchEnd+iBatchSize, iMaxPages);
                    requestBatch();
                }
            };

            let requestBatch = function() {
                if(continueCallback) {
                    if(continueCallback(results)===false) {
                        resolve(results);
                    }
                }
                for(let i=iCurrentPage; i<=iBatchEnd; i++) {
                    self._request(url, method, body, iCurrentPage++).then(
                        responseHandler
                        , reason => {
                            if(++iReceived===iMaxPages) fReject("Error during requesting pages:" + reason);
                        }
                    );
                }
            };

            requestBatch();
        });
    }
}