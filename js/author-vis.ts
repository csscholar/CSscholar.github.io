/**
 * @fileoverview This file contains the code for the author list view.
 * @author Daniel Nichols
 * @date April 2023
 */

// @ts-ignore Import module
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
// @ts-ignore Import module
import papaparse from 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm';
import { Dataset, Filter } from './dataset.min.js';

const NUMERIC_COLUMNS = ["year", "referenceCount", "citationCount", "influentialCitationCount", "authors_selfCitations"];
const CITATION_COLUMN = "citationCount";
const INITIAL_SORTED_COLUMN = "hIndex";
const DISPLAY_COLUMNS = ["hIndex", "count", CITATION_COLUMN, "authors_selfCitations", 
                        "selfCitationPercent", "influentialCitationCount", "coAuthors"];
const READABLE_COLUMN_NAME_MAP = {
    Position: "Position",
    Name: "Name", 
    citationCount: "Citations",
    influentialCitationCount: "Influential Citations",
    authors_selfCitations: "Self Citations",
    selfCitationPercent: "Median Self Citation %",
    coAuthors: "No. Co-Authors",
    count: "No. Papers",
    hIndex: "H-Index",
};
const COLUMN_DESCRIPTIONS = {
    hIndex: "At least h papers have at least h citations",
    count: "Total number of papers",
    citationCount: "Total number of citations (as reported by SemanticScholar)",
    authors_selfCitations: "Total number of self-citations (derived from SemanticScholar)",
    selfCitationPercent: "Median percentage of self-citations per-paper (derived from SemanticScholar)",
    influentialCitationCount: "Total number of influential citations (as reported by SemanticScholar https://www.semanticscholar.org/faq#influential-citations)",
    coAuthors: "Total number of unique Co-Authors",
};
const COLUMN_AGG_FUNC = {
    default: d3.sum,
    coAuthors: (x) => x,
    selfCitationPercent: d3.median,
};
const COLUMN_RENDERER_MAP = {
    selfCitationPercent: $.fn.dataTable.render.number(',', '.', 1, ''),
};
const IS_COLUMN_ORDERABLE = {
    default: true,
    Position: false,
    Name: false,
};
const INITIAL_VENUES = ["SC", "IPDPS", "HPDC", "ICS", "PPoPP"];

let dataset: Dataset | null = null;
let datatable = null;

$(function () {
    $("#load").show();

    papaparse.parse("/data/site-data.csv", {
        "download": true,
        "delimiter": ",",
        "header": true,
        "fastMode": true,
        "dynamicTyping": true,
        "complete": (results: object) => {
            /* create global dataset */
            dataset = new Dataset(results["data"]);

            /* create UI elements */
            const uniqueYears = dataset.getUnique("year").filter(d => d != 0);
            const uniqueVenues = dataset.getUnique("venue_acronym_acronym");
            initializeFilterUI(uniqueYears, uniqueVenues);

            /* create table */
            updateAuthorList(getFilter());
        }
    });
});

function updateAuthorList(filter: Filter|null = null) {
    $("#load").show();

    /* what columns are we showing */
    let columns = Array.from(DISPLAY_COLUMNS);

    /* preprocess author data */
    let byAuthor = dataset.getColumnsByAuthor(columns, filter);

    /* compute totals for each author; also create JSONL style array with data */
    const KEY_COL_NAME = "Name";
    let authorTable: Array<any> = [];
    for (const [authorName, metricObj] of Object.entries(byAuthor)) {
        let numValues = 0;
        let hIndex = 0;
        if (CITATION_COLUMN in (metricObj as object)) {
            hIndex = getHIndex(metricObj[CITATION_COLUMN]);
        }
        for (const [metricName, metricValues] of Object.entries(metricObj)) {
            if (!Array.isArray(metricValues)) continue;
            numValues = metricValues.length;
            let aggFunc = (metricName in COLUMN_AGG_FUNC) ? COLUMN_AGG_FUNC[metricName] : COLUMN_AGG_FUNC["default"];
            metricObj[metricName] = aggFunc(metricValues);
        }
        /* add paper count */
        metricObj["count"] = numValues;
        metricObj["hIndex"] = hIndex;

        let row: Array<any> = [0, authorName];
        for (const c of columns) {
            row.push(metricObj[c]);
        }
        authorTable.push(row);
    }

    /* style table */
    const FULL_COLUMNS = ["Position", KEY_COL_NAME].concat(columns);
    if (datatable) {
        datatable.clear();
        datatable.rows.add(authorTable);
        datatable.draw();
    } else {
        datatable = $("#list-view__table").DataTable({
            data: authorTable,
            columns: FULL_COLUMNS.map(c => getDataTableColumnSpec(c)),
            order: [[FULL_COLUMNS.indexOf(INITIAL_SORTED_COLUMN), 'desc']],
            pageLength: 25,
            rowCallback: function (nRow, aData, iDisplayIndex) {
                let table = $(this).DataTable();
                let info = table.page.info();
                if (table.order()[0][1] === "desc") {
                    $("td:nth-child(1)", nRow).html(String(info.start + iDisplayIndex + 1));
                } else {
                    $("td:nth-child(1)", nRow).html(String(info.recordsTotal - info.start - iDisplayIndex));
                }
                return nRow;
            },
            drawCallback: function () { $("#load").hide(); }
        });
        addTooltipsToTableHeader();
    }   
}

function addTooltipsToTableHeader() {
    $("#list-view__table thead th").each(function(idx: number) {
        let colName = DISPLAY_COLUMNS[idx-2];
        $(this).attr("title", COLUMN_DESCRIPTIONS[colName]);
    });
}

function getDataTableColumnSpec(columnName: string): object {
    let spec = { title: READABLE_COLUMN_NAME_MAP[columnName] };
    if (columnName in COLUMN_RENDERER_MAP) {
        spec["render"] = COLUMN_RENDERER_MAP[columnName];
    }
    spec["orderable"] = (columnName in IS_COLUMN_ORDERABLE) ? IS_COLUMN_ORDERABLE[columnName] : IS_COLUMN_ORDERABLE["default"];
    return spec;
}

function getHIndex(citations: Array<number>): number {
    citations.sort(function(a,b) { return b - a; });

    let hIndex = 0;
    for (let i = 0; i < citations.length; i++) {
        if (citations[i] >= i+1) {
            hIndex = i+1;
        } else {
            break;
        }
    }
    return hIndex;
}

function initializeFilterUI(availableYears: Array<number>, availableVenues: Array<string>) {
    /* years */
    availableYears.sort();
    let yearStartSelect = $("#years-filter-start");
    let yearEndSelect = $("#years-filter-end");
    for (const year of availableYears) {
        yearStartSelect.append($("<option>").val(year).text(year));
        yearEndSelect.append($("<option>").val(year).text(year));
    }
    /* set the start year to 10 years before the last year (inclusive) if possible */
    const lastYear = +availableYears[availableYears.length - 1];
    if (availableYears.includes(lastYear - 10)) {
        yearStartSelect.val(lastYear - 10);
    } else {
        yearStartSelect.find("option:first").prop("selected", true);
    }
    yearEndSelect.find("option:last").prop("selected", true);
    yearStartSelect.on("change", updateYears);
    yearEndSelect.on("change", updateYears);

    /* venues */
    let venueForm = $("#venues-form-hpc");
    for (const venue of availableVenues) {
        let checkbox = $("<div>")
            .addClass("form-check")
            .append(
            $("<input>")
                .addClass("settings-checkbox")
                .attr("type", "checkbox")
                .attr("id", `venues__${venue}`)
                .attr("name", "venue")
                .attr("value", venue)
                .addClass("form-check-input")
                .prop('checked', (INITIAL_VENUES.includes(venue)))
        ).append(
            $("<label>")
                .attr("for", `venues__${venue}`)
                .addClass("form-check-label")
                .text(venue)
        );
        venueForm.append(checkbox);
    }
    $("#venues-form input").on("change", function() { updateAuthorList(getFilter()); });
    $(".area-dropdown").on("click", function() { rotateCaret(this); });
}

function rotateCaret(element) {
    $(element).find("i").toggleClass("fa-circle-chevron-right fa-circle-chevron-down");
}

function getAllSelectValues(selector: string): Array<any> {
    let values: Array<any> = [];
    $(`${selector} option`).each(function() {
        values.push($(this).val());
    });
    return values;
}

function getFilter(): Filter {
    /* get selected years */
    const startYear = +$("#years-filter-start").find(":selected").val();
    const endYear = +$("#years-filter-end").find(":selected").val();
    const allYears = getAllSelectValues("#years-filter-start").map(y => +y);
    let validYears = allYears.filter(y => y>=startYear && y<=endYear);

    /* get selected venues */
    let validVenues = [];
    $("#venues-form input[type='checkbox']:checked").each(function () {
        validVenues.push($(this).val());
    });
    return new Filter(validYears, validVenues);
}

function updateYears() {
    /* ensure valid years */
    const startYear = +$("#years-filter-start").find(":selected").val();
    const endYear = +$("#years-filter-end").find(":selected").val();
    if (startYear > endYear) {
        console.log(`Start year (${startYear}) cannot be later than end year (${endYear}).`);
        $("#years-filter-start").val(endYear).change();
        return;
    }

    /* disable invalid years in start and end */
    $("#years-filter-start option").each(function() {
        let option = $(this);
        option.prop("disabled", (+option.val()) > endYear);
    });
    $("#years-filter-end option").each(function() {
        let option = $(this);
        option.prop("disabled", (+option.val()) < startYear);
    });

    /* update table */
    updateAuthorList(getFilter());
}
