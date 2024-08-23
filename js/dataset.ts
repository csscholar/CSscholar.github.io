

class Filter {
    years_: Array<object>;
    venues_: Array<object>;
    yearColumn_: string;
    venueColumn_: string;

    constructor(years, venues, yearColumn = "year", venueColumn = "venue_acronym") {
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
        let groups = {};
        for (let row of this.data_) {
            if (filter && !filter.isValid(row)) continue;
            let key = row[column];
            if (!(key in groups)) {
                groups[key] = [];
            }
            groups[key].push(row);
        }
        return groups;
    }

    getVenuesByArea(filter: Filter|null = null): object {
        let data = this.groupBy("area", filter);
        for (let [area, group] of Object.entries(data)) {
            data[area] = new Set(group.map(d => d["venue_acronym"]));
        }
        return data;
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
        let coAuthors = this.getUniqueCoAuthors(filter);

        /* compute selfCitationPercent */
        for (let [author, pubs] of Object.entries(data)) {
            data[author] = convertArrayToObjectOfLists(pubs);
            data[author]["coAuthors"] = coAuthors[author];

            /* only keep columns in data[author] */
            getColumnSubset(data[author], columns);
        }

        return data;
    }

    getUniqueCoAuthors(filter: Filter|null = null): object {
        let data = this.groupBy("dblp", filter);

        let coAuthors = {}; // key: author name, value: set of co-authors
        for (let authors of Object.values(data)) {
            for (let authorRow of authors) {
                let authorName = authorRow["authors_name"];
                if (!(authorName in coAuthors)) {
                    coAuthors[authorName] = new Set();
                }
                for (let coAuthor of authors) {
                    if (coAuthor["authors_name"] != authorName) {
                        coAuthors[authorName].add(coAuthor["authors_name"]);
                    }
                }
            }
        }

        /* convert sets to set size */
        for (let [author, coAuthorSet] of Object.entries(coAuthors)) {
            coAuthors[author] = (coAuthorSet as Set<string>).size;
        }
        return coAuthors;
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