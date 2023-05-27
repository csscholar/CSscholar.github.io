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

const CITATION_COLUMN = "citationCount";
const INITIAL_SORTED_COLUMN = "hIndex";
const DISPLAY_COLUMNS = ["hIndex", "count", CITATION_COLUMN, "authors_selfCitations", 
                        "authors_selfCitationsPercent", "influentialCitationCount", "coAuthors"];
const READABLE_COLUMN_NAME_MAP = {
    Position: "Position",
    Name: "Name", 
    citationCount: "Citations",
    influentialCitationCount: "Influential Citations",
    authors_selfCitations: "Self Citations",
    authors_selfCitationsPercent: "Median Self Citation %",
    coAuthors: "No. Co-Authors",
    count: "No. Papers",
    hIndex: "H-Index",
};
const COLUMN_DESCRIPTIONS = {
    hIndex: "At least h papers have at least h citations",
    count: "Total number of papers",
    citationCount: "Total number of citations (as reported by SemanticScholar)",
    authors_selfCitations: "Total number of self-citations (derived from SemanticScholar)",
    authors_selfCitationsPercent: "Median percentage of self-citations per-paper (derived from SemanticScholar)",
    influentialCitationCount: "Total number of influential citations (as reported by SemanticScholar https://www.semanticscholar.org/faq#influential-citations)",
    coAuthors: "Total number of unique Co-Authors",
};
const COLUMN_AGG_FUNC = {
    default: d3.sum,
    coAuthors: (x) => x,
    authors_selfCitationsPercent: d3.median,
};
const COLUMN_RENDERER_MAP = {
    authors_selfCitationsPercent: $.fn.dataTable.render.number(',', '.', 1, ''),
};
const IS_COLUMN_ORDERABLE = {
    default: true,
    Position: false,
    Name: false,
};
const INITIAL_VENUES = ["SC", "IPDPS", "ISC", "ICS", "PPoPP", "HPDC", "CLUSTER", "ICPP", "EuroPar", "CCGRID", "HiPC"];
const INITIAL_AREAS = ["HPC"];
const AREA_READABLE_NAME_MAP = {
    "HPC": "High Performance Computing",
    "COMPBIO": "Computational Biology",
    "ARCH": "Architecture",
    "SE": "Software Engineering",
    "VIS": "Visualization",
    "PL": "Programming Languages",
    "NLP": "Natural Language Processing",
    "DB": "Databases",
    "ML": "Machine Learning",
    "CV": "Computer Vision",
};

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
            const uniqueYears = dataset.getUnique("year");
            const venueMap = dataset.getVenuesByArea();
            initializeYearsFilterUI(uniqueYears);
            initializeVenuesFilterUI(venueMap);

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

function initializeYearsFilterUI(availableYears: Array<number>) {
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
}

function initializeVenuesFilterUI(venueMap: object) {

    const sortedAreas = Object.keys(venueMap).sort();
    let filterElement = $("#venues-form");

    for (let area of sortedAreas) {
        let id = `venues-form-${area}`;
        const text = (area in AREA_READABLE_NAME_MAP) ? AREA_READABLE_NAME_MAP[area] : area;
        let areaDiv = $("<div>");
        let areaHeader = $("<a>")
                .addClass("area-dropdown")
                .attr("id", `areas-dropdown__${area}`)
                .attr("data-bs-toggle", "collapse")
                .attr("href", `#${id}`)
                .attr("role", "button")
                .attr("aria-expanded", "false")
                .attr("aria-controls", id)
                .html(`<i class="fa fa-circle-chevron-right"></i> ${text}`);
        let areaCheckBox = $("<input>")
                .addClass("settings-checkbox form-check-inline area-checkbox")
                .attr("type", "checkbox")
                .attr("id", `areas__${area}`)
                .attr("value", area as string)
                .prop("checked", INITIAL_AREAS.includes(area as string));
        let areaDropDown = $("<div>")
                .addClass("venue-list form-grid collapse")
                .attr("id", id);

        const sortedVenues = Array.from(venueMap[area]).sort();
        for (let venue of sortedVenues) {
            let checkbox = $("<div>")
                .addClass("form-check")
                .append(
                    $("<input>")
                        .addClass("settings-checkbox form-check-input venue-checkbox")
                        .attr("type", "checkbox")
                        .attr("id", `venues__${venue}`)
                        .attr("name", "venue")
                        .attr("value", venue as string)
                        .prop('checked', INITIAL_VENUES.includes(venue as string))
                ).append(
                    $("<label>")
                        .attr("for", `venues__${venue}`)
                        .addClass("form-check-label")
                        .text(venue as string)
                );
            areaDropDown.append(checkbox);
        }
        
        areaDiv.append(areaHeader, areaCheckBox, areaDropDown);
        filterElement.append(areaDiv);
    }

    $("#venues-form .venue-checkbox").on("change", function() { updateAuthorList(getFilter()); });
    $("#venues-form .area-checkbox").on("change", function() { updateSelectedAreas(this); });
    $(".area-dropdown").on("click", function() { rotateCaret(this); });
}

function updateSelectedAreas(element) {
    let venues = $(element).parent().find(".venue-checkbox");
    let isChecked = $(element).prop("checked");
    $(venues).each(function() { $(this).prop("checked", isChecked); });
    updateAuthorList(getFilter());
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
