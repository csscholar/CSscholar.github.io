const TITLE_COL = "Document Title";
const AUTHORS_COL = "Authors";
const NUM_AUTHORS_COL = "Authors Count";
const INSTITUTION_COL = "Author Affiliations";
const VENUE_COL = "Publication Title";
const YEAR_COL = "Publication Year";
const CITATION_COL = "Article Citation Count";
const CITATION_RATE_COL = "Citation Rate";
const REFERENCES_COL = "Reference Count";
const ABSTRACT_COL = "Abstract";
const KEYWORDS_COL = "Author Keywords";

const COLOR_PALETTE = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
const VENUE_COLORS = { SC: COLOR_PALETTE[0], IPDPS: COLOR_PALETTE[1], TPDS: COLOR_PALETTE[2] };

const KEYWORD_FILTER = ["edge server", "cloud-edge computing", "federated learning", "edge computing", "cloud", "cloud computing",
    "blockchain", "mobile edge computing", "pervasive edge computing", "multi-access edge computing", "clouds",
    "physical layer", "cloud security", "smart grids", "smart grid", "privacy preserving", "cloud storage",
    "access control", "ciphertext policy", "key management", "revocation", "identity-based cryptography",
    "anonymous authentication", "certificateless signature", "wireless body area network", "wireless sensor networks",
    "wireless sensors networks", "distributed trust model", "wireless networks", "denial-of-service attack",
    "crowdsourcing", "mobile sensing", "delay tolerant networks", "mobile social networks",
    "wireless", "indoor localization", "site survey", "cyber security", "ddos attacks", "flash crowds"];

let plots = {};
let previousAggFunction = "";

d3.csv("/data/all-pubs.csv").then((data) => {

    /* fix data issues */
    data = data.map(x => {
        x[VENUE_COL] = normalizeVenueNames(x[VENUE_COL]);
        if (x[CITATION_COL] == "") x[CITATION_COL] = 0;
        x[CITATION_COL] = Number(x[CITATION_COL]);
        x[INSTITUTION_COL] = x[INSTITUTION_COL].split(';').map(x => x.split(',').slice(0, 2)).join(';');
        x[KEYWORDS_COL] = x[KEYWORDS_COL].toLowerCase();
        return x;
    });

    /* pass data thru filter */
    data = data.filter(d => !d[KEYWORDS_COL].split(';').some(x => KEYWORD_FILTER.includes(x.toLowerCase())));
    data = data.filter(d => !d[TITLE_COL].toLowerCase().includes("cloud"));
    data = data.filter(d => !d[TITLE_COL].toLowerCase().includes("server"));
    data = data.filter(d => !d[TITLE_COL].toLowerCase().includes("iot"));
    data = data.filter(d => !d[TITLE_COL].toLowerCase().includes("edge computing"));


    /* create settings ui */
    createSettings(data);
    updateSettingsFromURL();

    /* list top papers */
    listTopPapers(data, 25);

    /* draw plots */
    drawMainPlot(data);

    // not working
    //drawAbstractWordCloud(data);
    //updateAbstractWordCloud(data);

    $("#year__2019").prop("checked", false);
    $("#settings__years fieldset").append($("<i>")
        .css("margin-top", "10px")
        .css("font-size", "10pt")
        .text("* SC 2019 data missing")
    );
    update(data);
});

function normalizeVenueNames(name) {
    let ipdps_names = ["IPDPS", "International Parallel & Distributed Processing Symposium",
        "International Parallel and Distributed Processing Symposium", "International Symposium on Parallel and Distributed Processing"];
    let sc_names = ["International Conference on High Performance Computing, Networking, Storage and Analysis", "International Conference for High Performance Computing, Networking, Storage and Analysis"];
    let tpds_names = ["Transactions on Parallel and Distributed Systems"];

    if (ipdps_names.some(n => name.includes(n))) {
        return "IPDPS";
    } else if (sc_names.some(n => name.includes(n))) {
        return "SC";
    } else if (tpds_names.some(n => name.includes(n))) {
        return "TPDS";
    } else {
        console.log("Unknown venue: " + name);
        return "Unknown Venue";
    }
}

function getColumn(data, columnName) {
    return Array.from(data.map(d => d[columnName]));
}

function createSettings(data) {
    const allVenues = getColumn(data, VENUE_COL);
    const venues = [...new Set(allVenues)];
    const allYears = getColumn(data, YEAR_COL);
    const years = [...new Set(allYears)];

    let venueForm = $("#settings__venues > fieldset");
    for (venue of venues) {
        let checkbox = $("<div>").append(
            $("<input>")
                .addClass("settings-checkbox")
                .attr("type", "checkbox")
                .attr("id", `venues__${venue}`)
                .attr("name", "venue")
                .attr("value", venue)
                .prop('checked', true)
        ).append(
            $("<label>")
                .attr("for", `venues__${venue}`)
                .text(venue)
        );
        venueForm.append(checkbox);
    }

    let yearForm = $("#settings__years > fieldset");
    for (year of years) {
        let checkbox = $("<div>").append(
            $("<input>")
                .addClass("settings-checkbox")
                .attr("type", "checkbox")
                .attr("id", `year__${year}`)
                .attr("name", "year")
                .attr("value", year)
                .prop('checked', true)
        ).append(
            $("<label>")
                .attr("for", `year__${year}`)
                .text(year)
        );
        yearForm.append(checkbox);
    }

    $('#settings input').change(function () {
        update(data);
    });

    $('#settings__papers-count__selection').change(function () {
        update(data);
    });

    $('#settings__yaxis').change(function () { update(data); });
    $('#settings__xaxis').change(function () { update(data); });
    $('#settings__agg').change(function () { update(data); });
}

function updateSettingsFromURL() {
    const params = new URLSearchParams(window.location.search);

    function setSelectFromParam(param_name, selectId) {
        if (params.has(param_name)) {
            const possibleVals = $(`#${selectId} option`).toArray().map(x => x.value);
            if (possibleVals.includes(params.get(param_name))) {
                $(`#${selectId}`).val(params.get(param_name));
            }
        }
    }

    setSelectFromParam("numpapers", "settings__papers-count__selection");
    setSelectFromParam("xaxis", "settings__xaxis");
    setSelectFromParam("yaxis", "settings__yaxis");
    setSelectFromParam("agg", "settings__agg");

    if (params.has("years")) {
        $("#settings__years input").prop("checked", false);
        const years = params.get("years").split(",");
        years.forEach(year => $(`#year__${year}`).prop("checked", true));
    }

    if (params.has("venues")) {
        $("#settings__venues input").prop("checked", false);
        const venues = params.get("venues").split(",");
        venues.forEach(venue => $(`#venues__${venue}`).prop("checked", true));
    }
}

function getSelectedCheckboxes(name) {
    let values = [];
    $(`#settings input[name="${name}"]:checked`).each(function () { values.push($(this).val()); });
    return values;
}

function update(data) {
    const years = getSelectedCheckboxes('year');
    const venues = getSelectedCheckboxes('venue');

    /* filter years */
    data = data.filter((val, idx, arr) => years.includes(val[YEAR_COL]));

    /* filter venues */
    data = data.filter((val, idx, arr) => venues.includes(val[VENUE_COL]));

    /* update list */
    const N = $("#settings__papers-count__selection option:selected").val();
    listTopPapers(data, N);

    /* update plots */
    let yAxis = $('#settings__yaxis option:selected').val();
    let xAxis = $('#settings__xaxis option:selected').val();
    let groupByAgg = $('#settings__agg option:selected').val();
    updateMainPlot(data, xAxis, yAxis, groupByAgg);
}

function listTopPapers(data, N) {
    data = data.slice(0); // shallow copy
    data.sort((a, b) => b[CITATION_COL] - a[CITATION_COL]);
    let topN = data.slice(0, N);

    function getPaper(citations, title, authors, venue, year) {
        return $("<div>").addClass("paper-item")
            .append($("<div>").addClass("paper-item__citation-count").text(citations))
            .append($("<div>").addClass("paper-item__title").text(title))
            .append($("<div>").addClass("paper-item__author-list").html(`<i>Authors:</i> ${authors}`))
            .append($("<div>").addClass("paper-item__venue").html(`<i>Venue:</i> ${venue} ${year}`))
    }

    let listRoot = $(".paper-list").first();
    listRoot = listRoot.empty();    // clear out first
    listRoot = listRoot.append($("<div>").addClass("paper-header")
        .append($("<div>").addClass("paper-item__citation-count").text("Citations"))
        .append($("<div>").addClass("paper-item__title").text("Paper"))
    );
    for (paper of topN) {
        listRoot = listRoot.append(
            getPaper(paper[CITATION_COL], paper[TITLE_COL], paper[AUTHORS_COL], paper[VENUE_COL], paper[YEAR_COL])
        );
    }
    $(".paper-item:odd").css("background-color", "#eee");   // alternating colors
}

function getSplitColumnUnique(data, column) {
    let raw = getColumn(data, column);
    let all = raw.map(a => a.split(";")).flat().map(a => a.trim());
    return [...new Set(all)].filter(x => x != "");
}

function sortBySums(arr) {
    let sums = arr.map(x => [x[1].reduce((acc, val) => acc + val), x]);
    sums.sort((a, b) => b[0] - a[0]);
    return sums.map(x => x[1]);
}

function capitalize(s) {
    return s.split(" ").map(c => c[0].toUpperCase() + c.slice(1)).join(" ");
}

function median(arr) {
    const sorted = Array.from(arr).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
}

function hindex(arr) {
    let sorted = Array.from(arr).sort((a, b) => a - b);
    for (const [idx, val] of sorted.entries()) {
        const result = sorted.length - idx;
        if (result <= val) {
            return result;
        }
    };
    return 0;
}

function countByColumn(data, column = AUTHORS_COL, by = 'citations', agg = 'total', isSplit = true) {
    if (isSplit) {
        vals = getSplitColumnUnique(data, column);
    } else {
        vals = [...new Set(getColumn(data, column))];
    }
    let bin = {};
    for (val of vals) bin[val] = [];
    for (row of data) {
        for (col of row[column].split(';')) {
            col = col.trim();
            if (col == "") continue;
            if (by == 'citations') bin[col].push(+row[CITATION_COL]);
            else if (by == "citation rate") bin[col].push(+row[CITATION_RATE_COL]);
            else if (by == "references") bin[col].push(+row[REFERENCES_COL]);
            else if (by == "# authors") bin[col].push(+row[NUM_AUTHORS_COL]);
            else if (by == "papers") bin[col].push(1);
        }
    }
    for (col in bin) {
        if (agg == 'total') {
            bin[col] = bin[col].reduce((acc, val) => acc + val);
        } else if (agg == "mean") {
            bin[col] = bin[col].reduce((acc, val) => acc + val) / bin[col].length;
        } else if (agg == "median") {
            bin[col] = median(bin[col]);
        } else if (agg == "min") {
            bin[col] = d3.min(bin[col]);
        } else if (agg == "max") {
            bin[col] = d3.max(bin[col]);
        } else if (agg == "h-index") {
            bin[col] = hindex(bin[col]);
        }
    }
    return bin;
}

function drawMainPlot(data, column = VENUE_COL, by = "citations", agg = "total") {
    const isSplitColumn = [AUTHORS_COL, INSTITUTION_COL, KEYWORDS_COL].includes(column);
    let counts = Object.entries(countByColumn(data, column, by, agg, isSplitColumn));

    if (agg === "none") {
        counts = sortBySums(counts);
    } else {
        counts.sort((a, b) => b[1] - a[1]);
    }

    const maxX = (agg === "none") ? 10 : 50;
    if (counts.length > maxX) {
        counts = counts.slice(0, maxX);
    }

    let X = [], y = [];
    counts.forEach(a => { X.push(a[0]); y.push(a[1]) });

    const margins = { left: 40, right: 25, top: 40, bottom: 100 };
    const aggStr = (agg === "none") ? "" : agg;
    const title = capitalize(`${aggStr} ${by} By ${column}`);
    const colorMap = (column === VENUE_COL) ? VENUE_COLORS : "#9467bd";
    previousAggFunction = agg;

    if (agg === "none") {
        drawViolinPlot("#main-plot", X, y, margins, 1200, 600, title, 45, colorMap);
    } else {
        drawBarPlot("#main-plot", X, y, margins, 1200, 600, title, 45, colorMap);
    }
}

function updateMainPlot(data, column = VENUE_COL, by = "citations", agg = "total") {
    const isSplitColumn = [AUTHORS_COL, INSTITUTION_COL, KEYWORDS_COL].includes(column);
    let counts = Object.entries(countByColumn(data, column, by, agg, isSplitColumn));

    if (agg === "none") {
        counts = sortBySums(counts);
    } else {
        counts.sort((a, b) => b[1] - a[1]);
    }

    const maxX = (agg === "none") ? 10 : 50;
    if (counts.length > maxX) {
        counts = counts.slice(0, maxX);
    }

    let X = [], y = [];
    counts.forEach(a => { X.push(a[0]); y.push(a[1]) });

    const title = capitalize(`${agg} ${by} By ${column}`);
    const colorMap = (column == VENUE_COL) ? VENUE_COLORS : "#9467bd";

    if (agg === "none") {
        if (previousAggFunction !== "none") {
            $("#main-plot svg").children("g").children("rect").remove();
        }
        updateViolinPlot("#main-plot", X, y, title, colorMap);
    } else {
        if (previousAggFunction === "none") {
            $("#main-plot svg").children("g").children(".violin").remove();
        }
        updateBarPlot("#main-plot", X, y, title, colorMap);
    }
    previousAggFunction = agg;
}

function drawAbstractWordCloud(data) {
    const abstracts = getColumn(data, ABSTRACT_COL);
    let words = abstracts.flat();
    drawWordCloud("#abstract-word-cloud", words, 800, 600, "test");
}

function updateAbstractWordCloud(data) {
    const abstracts = getColumn(data, ABSTRACT_COL);
    let words = abstracts.flat();
    updateWordCloud("#abstract-word-cloud", words);
}

function drawBarPlot(id, X, y, margins, width, height, title, xAxisRotation, colorMap) {
    const realWidth = width - margins.left - margins.right;
    const realHeight = height - margins.top - margins.bottom;

    let svg = d3.select(id)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + margins.left + "," + margins.top + ")");

    let xScale = d3.scaleBand()
        .range([0, realWidth])
        .padding(0.2);
    let xAxis = svg.append("g")
        .attr("transform", `translate(0,${realHeight})`)
        .style("font-family", "Sans Serif");

    let yScale = d3.scaleLinear()
        .range([realHeight, 0]);
    let yAxis = svg.append("g")
        .style("font-family", "Sans Serif");

    addTitle(svg, title, margins, realWidth, realHeight);

    plots[id] = {
        svg: svg, xScale: xScale, xAxis: xAxis, yScale: yScale, yAxis: yAxis, realWidth: realWidth,
        realHeight: realHeight, margins: margins, xAxisRotation: xAxisRotation, colorMap: colorMap
    };

    updateBarPlot(id, X, y);
}

function updateBarPlot(id, X, y, newTitle = null, newColorMap = null) {
    let xScale = plots[id].xScale, xAxis = plots[id].xAxis;
    let yScale = plots[id].yScale, yAxis = plots[id].yAxis;
    let xAxisRotation = plots[id].xAxisRotation;
    let colorMap = newColorMap ?? plots[id].colorMap;
    plots[id].colorMap = colorMap;

    xScale.domain(X);
    xAxis.transition()
        .duration(1000)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("text-anchor", (xAxisRotation == 0) ? "center" : "end")
        .attr("transform", `rotate(-${plots[id].xAxisRotation})`);

    yScale.domain([0, d3.max(y)]);
    yAxis.transition().duration(1000).call(d3.axisLeft(yScale));

    let bars = [];
    for (idx in X) {
        bars.push({ key: X[idx], value: y[idx] });
    }

    let u = plots[id].svg.selectAll("rect")
        .data(bars);

    u.exit()
        .transition()
        .duration(500)
        .style('opacity', 0)
        .remove();

    u.enter()
        .append("rect")
        .merge(u)
        .transition()
        .duration(1000)
        .attr("x", d => xScale(d.key))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => plots[id].realHeight - yScale(d.value))
        .attr("fill", d => ((typeof colorMap === 'string') ? colorMap : colorMap[d.key]));

    if (newTitle != null) {
        addTitle(plots[id].svg, newTitle, plots[id].margins, plots[id].realWidth, plots[id].realHeight);
    }
}

function drawViolinPlot(id, X, y, margins, width, height, title, xAxisRotation, colorMap) {
    const realWidth = width - margins.left - margins.right;
    const realHeight = height - margins.top - margins.bottom;

    let svg = d3.select(id)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + margins.left + "," + margins.top + ")");

    let yScale = d3.scaleLinear()
        .domain(d3.extent(y.flat()))
        .range([realHeight, 0]);
    let yAxis = svg.append("g")
        .style("font-family", "Sans Serif");

    let xScale = d3.scaleBand()
        .range([0, realWidth])
        .padding(0.05);
    let xAxis = svg.append("g")
        .attr("transform", "translate(0," + realHeight + ")")
        .style("font-family", "Sans Serif");

    addTitle(svg, title, margins, realWidth, realHeight);

    plots[id] = {
        svg: svg, xScale: xScale, xAxis: xAxis, yScale: yScale, yAxis: yAxis, realHeight: realHeight,
        colorMap: colorMap, xAxisRotation: xAxisRotation
    };

    updateViolinPlot(id, X, y);
}

function updateViolinPlot(id, X, y, newTitle = null, newColorMap = null) {
    let xScale = plots[id].xScale, xAxis = plots[id].xAxis;
    let yScale = plots[id].yScale, yAxis = plots[id].yAxis;
    let xAxisRotation = plots[id].xAxisRotation;
    let colorMap = newColorMap ?? plots[id].colorMap;
    plots[id].colorMap = colorMap;

    xScale.domain(X);
    xAxis.transition()
        .duration(1000)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("text-anchor", (xAxisRotation == 0) ? "center" : "end")
        .attr("transform", `rotate(-${xAxisRotation})`);

    yScale.domain(d3.extent(y.flat()));
    yAxis.transition().duration(1000).call(d3.axisLeft(yScale));

    let histogram = d3.histogram()
        .domain(yScale.domain())
        .thresholds(yScale.ticks(20))
        .value(d => d);

    let bins = X.map((e, idx) => ({ key: e, value: y[idx] }));

    /* calculate max width */
    let maxWidth = 0;
    for (bin of y) {
        let maxLength = d3.max(histogram(bin).map(a => a.length));
        if (maxLength > maxWidth) maxWidth = maxLength;
    }
    let xNum = d3.scaleLinear()
        .range([0, xScale.bandwidth()])
        .domain([-maxWidth, maxWidth]);

    let area = d3.area()
        .x0(d => xNum(-d.length))
        .x1(d => xNum(d.length))
        .y(d => yScale(d.x0))
        .curve(d3.curveCatmullRom);

    let u = plots[id].svg.selectAll("g.violin")
        .data(bins);

    u.enter()
        .append("g")
        .attr("class", "violin")
        .append("path")
        .style("stroke", "none")
        .style("fill", d => (typeof colorMap === 'string') ? colorMap : colorMap[d.key])
        .attr("d", d => area(histogram(d.value)))
        .select(function () { return this.parentNode; })
        .merge(u)
        .transition()
        .duration(1000)
        .attr("transform", d => "translate(" + xScale(d.key) + ",0)");

    let paths = plots[id].svg.selectAll("g.violin path").data(bins);
    paths.enter()
        .merge(paths)
        .transition()
        .duration(1000)
        .style("fill", d => (typeof colorMap === "string") ? colorMap : colorMap[d.key])
        .attr("d", d => area(histogram(d.value)));

    u.exit()
        .transition()
        .duration(500)
        .style("opacity", 0)
        .remove();

    if (newTitle != null) {
        addTitle(plots[id].svg, newTitle, plots[id].margins, plots[id].realWidth, plots[id].realHeight);
    }
}

function drawWordCloud(id, words, width, height, title) {
    let fill = d3.scaleOrdinal(d3.schemeCategory10);
    let svg = d3.select(id)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    function draw() {
        let cloud = svg.selectAll("g text")
            .data(words, function (d) { return d.text; });

        cloud.enter()
            .append("text")
            .style("font-family", "Impact")
            .style("fill", function (d, i) { return fill(i); })
            .attr("text-anchor", "middle")
            .attr('font-size', 1)
            .text(function (d) { return d.text; });

        cloud.transition()
            .duration(600)
            .style("font-size", function (d) { return d.size + "px"; })
            .attr("transform", function (d) {
                return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
            })
            .style("fill-opacity", 1);

        cloud.exit()
            .transition()
            .duration(200)
            .style('fill-opacity', 1e-6)
            .attr('font-size', 1)
            .remove();
    }

    plots[id] = { height: height, width: width, svg: svg, draw: draw };
}

function updateWordCloud(id, words) {
    d3.layout.cloud().size([plots[id].width, plots[id].height])
        .words(words)
        .padding(5)
        .rotate(function () { return ~~(Math.random() * 2) * 90; })
        .font("Impact")
        .fontSize(function (d) { return d.size; })
        .on("end", plots[id].draw)
        .start();
}

function addTitle(svg, title, margins, width, height) {
    svg.selectAll("text.title").remove();

    svg.append("text")
        .attr("class", "title")
        .attr("x", width / 2)
        .attr("y", 0 - margins.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "16pt")
        .style("font-family", "Sans Serif")
        .text(title);
}