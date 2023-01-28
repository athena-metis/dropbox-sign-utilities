'use strict';

const extUIGetInsertLocation = () => {
    //Find the table listing the bulk documents
    const reportTables = document.getElementsByTagName('TABLE');
    if(!reportTables || reportTables.length===0) return;
    return reportTables[0];
};

const extUICreate = function(rootProps) {
    const reportTable = extUIGetInsertLocation();
    if (!reportTable) return;

    //Create and add a new report download button
    const dateFilter = createInput('uo-dbx-sign-utils-extension-datefilter', 'date', 'Updated after');
    dateFilter[1].value = (new Date(Date.now()-(3*31*86400000))).toISOString().replace(/T.*/,'');
    const textFilter = createInput('uo-dbx-sign-utils-extension-titlefilter', 'text', 'Subject starts with');
    const newButton = htmlElem('BUTTON', 'dig-Button dig-Button--opacity dig-Button--standard dig-Button--withIconLeft', {}, '',
        htmlElem('span', 'dig-Button-content', {}, 'Download CSV Report')
    );
    const newButtonWrapped = htmlElem('DIV', 'dig-FormRow dig-FormRow--input', {}, '',
        [
            htmlElem('LABEL', 'dig-FormLabel', {}, ''),
            newButton
        ]
    );

    const additionContainer = htmlElem('DIV', '', {}, '',
        htmlElem('DIV', 'dig-FormRow dig-FormRow--input dig-FormRow--split', {}, '', [
            dateFilter[0]
            , textFilter[0]
            , newButtonWrapped
        ])
    );
    additionContainer.id = 'uo-dbx-sign-utils-extension-container';
    reportTable.parentNode.prepend(additionContainer);

    newButton.addEventListener('click', evt => {
        let strUpdatedAfter = dateFilter[1].value!=='' ? dateFilter[1].value : undefined;
        let strNameStartsWith = textFilter[1].value!=='' ? textFilter[1].value : undefined;
        let dbx = new DropboxSign(rootProps.csrfToken ?? '');

        dbx.getBulkSendJobs(strUpdatedAfter, strNameStartsWith).then(docs => {
            if (docs.length===0) {
                alert('No documents found matching your criteria.');
                return;
            }

            dbx.getBulkCSVReportsForDocs(docs).then(outputReportLines => {
                dbx.getTemplateIdMap().then(templateIdMap => {
                        let fixedHeaders = ["Template Name", "Document Name", "Sent", "Signed Timestamp", "Signer Name", "Signer Email"];

                        //Add template names to CSV data
                        outputReportLines.forEach(line => line['Template Name'] = templateIdMap[line['Template ID']] || 'Unknown Template');
                    
                        //Group CSV lines by document id in preparation for converting field/row to field/col
                        let docData = groupByKey(
                            outputReportLines
                            ,"Document ID"
                            , [...fixedHeaders, "Field Name", "Value", "Role"]
                        );
                        
                        let otherHeaders = {};
                        Object.keys(docData).forEach(function(docId) {
                            docData[docId] = (() => {
                                let retLine = {};
                                //Get data for the fixed headers only from the Sender role data
                                fixedHeaders.forEach(f =>  
                                    retLine[f] = docData[docId].filter(row => row['Role']!=='Sender')[0][f]
                                );

                                //Pivot field rows into field columns
                                docData[docId].forEach(opts => { 
                                    otherHeaders[opts['Field Name']] = true;
                                    retLine[opts['Field Name']] = opts['Value']; 
                                });
                                return retLine;
                            })();
                        });
                        
                        //Output headers to use
                        let headers = [...fixedHeaders, ...Object.keys(otherHeaders)];
            
                        //Compose CSV Data
                        let csvOut = '"' + headers.join('","') + '"' + "\n";
                        csvOut += Object.keys(docData).map(docId =>
                            '"' + headers.map(header => docData[docId][header] || '').join('","') + '"' + "\n"
                        ).join("");
            
                        downloadCSV(
                            'hellosign-report-' 
                            + (new Date()).toLocaleDateString('en-GB').replace(/([0-9]{2})\/([0-9]{2})\/([0-9]{4})/, '$3-$2-$1') 
                            + '_'
                            + (new Date()).toLocaleTimeString('en-GB').replace(/:/g,'-')
                            + '.csv'
                            , csvOut
                        );

                    }, reason => alert('Error: ' + reason)
                );
            });
        });
    });
};