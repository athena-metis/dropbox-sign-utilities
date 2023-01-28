'use strict';

const filterObject = (obj, keepKeys) => {
    Object.keys(obj).forEach(function(key) {
      if (keepKeys.indexOf(key)===-1) delete obj[key];
    });
    return obj;
}

const groupByKey = (arr, keyName, onlyPreserveElements) => {
    let ret = {};
    arr.forEach(function(row) {
        if (row[keyName]===undefined) return;
        if(!ret.hasOwnProperty(row[keyName])) ret[row[keyName]] = [];
        ret[row[keyName]].push(filterObject(JSON.parse(JSON.stringify(row)), onlyPreserveElements));
    });
    return ret;
}

const downloadURI = (uri, name) => {
    var link = document.createElement("a");
    link.download = name;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

const downloadCSV = (name, csvData) => {
    downloadURI('data:text/csv;base64,' + btoa(csvData), name);
}

const convertTimestampToReadable = timestamp => {
    return ("" + timestamp)
        .replace(/^([0-9]{2}) \/ ([0-9]{2}) \/ ([0-9]{4}) ([0-9]{2}):([0-9]{2}):([0-9]+)$/i, '$3-$1-$2 $4:$5:$6')
        .replace(/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})([+-][0-9]{4})$/i, '$1-$2-$3 $4:$5:$6');
}

const parseCSV = csvData => {
    let parsedLines = csvData
        .split("\n")
        .map(function(line) {
            let out = [];
            let inString = false; 
            let posIdx = 0;
            [...line.matchAll(/([ \t]*,[ \t]*|$)/g)].forEach((div) => { 
                let str = div.input.substr(posIdx, div.index-posIdx); 
                !inString ? out[out.length]='' : false; 
                let inStringNext = (inString && str.substr(-1,1) !== '"') 
                    || (!inString && str[0] === '"'
                        && str.substr(-1,1) !== '"'
                    );
                out[out.length-1] += str + (inString ? div[0] : "");
                posIdx = div.index + div[0].length;
                if(
                    (
                        inString
                        && !inStringNext
                    ) 
                    || (
                        str[0] === '"'
                        && str.substr(-1,1) === '"'
                    )
                ) out[out.length-1] = out[out.length-1].replace(/(^"|"$)/g,'').replace(/""/g,'"');
                inString = inStringNext;
            });
            return out; 
        });
      
    let ret = [];
    for(let lineIdx=1; lineIdx < parsedLines.length; lineIdx++) {
        ret[lineIdx-1] = {};
        parsedLines[lineIdx].forEach((val,colIdx) => {
            ret[lineIdx-1][parsedLines[0][colIdx]] = val;
        });
    }
    return ret;
}