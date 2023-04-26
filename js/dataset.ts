

class Filter {
    years_: Array<object>;
    venues_: Array<object>;
    yearColumn_: string;
    venueColumn_: string;

    constructor(years, venues, yearColumn = "year", venueColumn = "venue_acronym_acronym") {
        this.years_ = years;
        this.venues_ = venues;
        this.yearColumn_ = yearColumn;
        this.venueColumn_ = venueColumn;
    }

    isValid(dataElement) {
        return this.years_.includes(dataElement[this.yearColumn_]) &&
            this.venues_.includes(dataElement[this.venueColumn_]);
    }
}

class Dataset {
    data_: Array<object>;

    constructor(dataObj: Array<object>) {
        this.data_ = dataObj;
    }

    getUnique(column: string, removeEmptyStr: boolean = true) {
        const uniq = new Set(this.data_.map(d => d[column]));
        if (removeEmptyStr) {
            uniq.delete('');
        }
        return Array.from(uniq);
    }

    getFilteredData(filter: Filter|null) {
        if (filter)
            return this.data_.filter(d => filter.isValid(d));
        else
            return this.data_;
    }

    groupBy(column: string, filter: Filter|null = null): object {
        let data = this.getFilteredData(filter);
        let groups = {};
        for (let row of data) {
            let key = row[column];
            if (!(key in groups)) {
                groups[key] = [];
            }
            groups[key].push(row);
        }
        return groups;
    }

    /**
     * Returns a table of data grouped by author.
     * @param {Array} columns - The columns to group by author.
     * @param {Filter} filter - The filter to apply to the data.
     * @returns {Object} - A table of data grouped by author.
     *      The keys are the author names, and the values are objects
     *      with the columns as keys and the values are arrays of the
     *      values for that column.
     *      For example, if columns = ["citationCount", "year"],
     *      then the value for the key "John Smith" would be:
     *      {
     *          citationCount: [1, 2, 3],
     *          year: [2010, 2011, 2012]
     *      }
    */
    getColumnsByAuthor(columns: Array<string>, filter: Filter|null = null): object {
        let data = this.groupBy("authors_name", filter);

        /* compute selfCitationPercent */
        for (let [author, pubs] of Object.entries(data)) {
            for (let pub of pubs) {
                if (+pub["referenceCount"] != 0) {
                    pub["selfCitationPercent"] = pub["authors_selfCitations"] / +pub["referenceCount"] * 100.0;
                } else {
                    pub["selfCitationPercent"] = 0;
                }
            }
            data[author] = convertArrayToObjectOfLists(pubs);

            /* only keep columns in data[author] */
            getColumnSubset(data[author], columns);
        }

        return data;
    }
}

function getColumnSubset(obj: object, columns: Array<string>) {
    for (let col of Object.keys(obj)) {
        if (!columns.includes(col)) {
            delete obj[col];
        }
    }
}

/**
 * Converts an array of objects to an object of lists.
 * @param {Array} arr - The array of objects to convert.
 * @returns {Object} - An object of lists.
 */
function convertArrayToObjectOfLists(arr: Array<any>): object {
    const objOfLists = {};

    arr.forEach(obj => {
        Object.keys(obj).forEach(key => {
            if (objOfLists[key] === undefined) {
                objOfLists[key] = [obj[key]];
            } else {
                objOfLists[key].push(obj[key]);
            }
        });
    });

    return objOfLists;
}



export { Dataset, Filter };