import Map from "https://js.arcgis.com/4.22/@arcgis/core/Map.js";
import WebMap from "https://js.arcgis.com/4.22/@arcgis/core/WebMap.js";
import MapView from "https://js.arcgis.com/4.22/@arcgis/core/views/MapView.js";
import TileLayer from "https://js.arcgis.com/4.22/@arcgis/core/layers/TileLayer.js";
import Home from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Home.js";
import Legend from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Legend.js";
import Search from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Search.js";
import Expand from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Expand.js";
import { whenFalseOnce } from "https://js.arcgis.com/4.22/@arcgis/core/core/watchUtils.js";

import { appConfig } from "./config.js";
import { appState } from "./state.js";

async function init() {
  // query for elements
  const resultsNode = document.getElementById("results");
  const attendanceNode = document.getElementById("attendance");
  const housingSectionNode = document.getElementById("housingSection");
  const housingNode = document.getElementById("housing");
  const programTypeNode = document.getElementById("programType");
  const schoolTypeNode = document.getElementById("schoolType");
  const resultBlockNode = document.getElementById("resultBlock");
  const paginationNode = document.getElementById("pagination");
  const filtersNode = document.getElementById("filters");
  const resetNode = document.getElementById("reset");
  const flowNode = document.getElementById("flow");
  const themeNode = document.getElementById("themeToggle");
  const darkThemeCss = document.getElementById("jsapi-theme-dark");
  const lightThemeCss = document.getElementById("jsapi-theme-light");

  async function getAttachment(objectId, result) {
    const campusImageContainerNode = document.getElementById(
      "campusImageContainer"
    );
    campusImageContainerNode.innerHTML = "";

    const attachments = await collegeLayer.queryAttachments({
      objectIds: [objectId],
      num: 1,
    });

    const attachmentGroup = attachments[objectId];

    if (attachmentGroup) {
      const attachment = attachmentGroup[0];
      const image = document.createElement("img");
      image.src = `${attachment.url}/${attachment.name}`;
      campusImageContainerNode.appendChild(image);
      return;
    }

    const container = document.createElement("div");
    container.id = "campusViewDiv";
    campusImageContainerNode.appendChild(container);

    const map = new Map({
      basemap: "streets-vector",
    });

    const view = new MapView({
      container,
      map,
      center: [result.geometry.longitude, result.geometry.latitude],
      zoom: 15,
    });

    view.ui.components = [];
  }

  // display requested item data
  // handle flow destroying dom of added panel...
  async function resultClickHandler(objectId) {
    appState.savedExtent = view.extent.clone();
    appState.activeItem = true;

    await whenFalseOnce(collegeLayerView, "updating");

    const { features } = await collegeLayerView.queryFeatures({
      returnGeometry: true,
      outSpatialReference: view.spatialReference,
      objectIds: [objectId],
      outFields: appConfig.collegeLayerOutFields,
    });

    const result = features[0];

    if (!result.geometry || !result.attributes) {
      return;
    }

    filtersNode.hidden = true;
    const attributes = result.attributes;
    const detailPanelNode = document.getElementById("detail-panel");
    // a janky way to replace content in a single panel vs appending entire new one each time
    if (!detailPanelNode) {
      const panel = document.createElement("calcite-panel");
      panel.heading = handleCasing(attributes["NAME"]);
      panel.summary = `${handleCasing(attributes["CITY"])}, ${
        attributes["STATE"]
      }`;
      panel.id = "detail-panel";
      panel.addEventListener("calcitePanelBackClick", async () => {
        if (appState.savedExtent) {
          await view.goTo(appState.savedExtent);
          appState.savedExtent = null;
        }
        appState.activeItem = false;
        filtersNode.hidden = false;
      });

      // Contain the calcite-block elements for the scrollbar
      const div = document.createElement("div");
      div.classList.add("calcite-panel-contents");

      const blockOne = document.createElement("calcite-block");
      blockOne.classList.add("calcite-block-contents");
      blockOne.heading = "Institution overview";
      blockOne.collapsible = true;
      blockOne.open = true;

      const blockTwo = document.createElement("calcite-block");
      blockTwo.classList.add("calcite-block-contents");
      blockTwo.heading = "Student body";
      blockTwo.collapsible = true;
      blockTwo.open = true;

      const blockThree = document.createElement("calcite-block");
      blockThree.classList.add("calcite-block-contents");
      blockThree.heading = "Housing";
      blockThree.collapsible = true;
      blockThree.open = true;

      const blockFour = document.createElement("calcite-block");
      blockFour.classList.add("calcite-block-contents");
      blockFour.heading = "Contact";
      blockFour.collapsible = true;
      blockFour.open = true;

      const campusImageNode = document.createElement("div");
      campusImageNode.id = "campusImageContainer";
      campusImageNode.className = "campus-image-container";

      blockOne.appendChild(campusImageNode);

      if (attributes["WEBSITE"]) {
        const itemWebsite = document.createElement("calcite-button");
        itemWebsite.id = "detail-website-link";
        itemWebsite.iconEnd = "launch";
        itemWebsite.slot = "footer-actions";
        itemWebsite.scale = "l";
        itemWebsite.width = "full";
        itemWebsite.innerText = `Learn more`;
        itemWebsite.href = `http://${attributes["WEBSITE"]}`;
        itemWebsite.rel = `noref noreferrer`;
        itemWebsite.target = `blank`;
        panel.appendChild(itemWebsite);
      }

      const notice = document.createElement("calcite-notice");
      notice.active = true;
      notice.width = "full";

      const message = document.createElement("span");
      message.id = "overview-text";
      message.slot = "message";
      message.innerText = attributes["overview"]
        ? attributes["overview"]
        : "No overview available";

      notice.appendChild(message);
      blockOne.appendChild(notice);

      if (attributes["schoolType"]) {
        const label = document.createElement("calcite-label");
        label.layout = "inline-space-between";
        label.innerText = "Institution Type";
        const span = document.createElement("span");
        span.id = "detail-type";
        span.innerText = `${handleCasing(attributes["schoolType"])}`;
        label.append(span);
        blockOne.appendChild(label);
      }

      if (attributes["TOT_ENROLL"]) {
        const label = document.createElement("calcite-label");
        label.layout = "inline-space-between";
        label.innerText = "Total enrollment";
        const span = document.createElement("span");
        span.id = "detail-total";
        span.innerText = `${parseInt(
          attributes["TOT_ENROLL"]
        ).toLocaleString()}`;
        label.append(span);
        blockTwo.appendChild(label);
      }

      if (attributes["FT_ENROLL"]) {
        const count =
          attributes["FT_ENROLL"] === -999 ? "0" : attributes["FT_ENROLL"];
        const label = document.createElement("calcite-label");
        label.layout = "inline-space-between";
        label.innerText = "Full time enrollment";
        const span = document.createElement("span");
        span.id = "detail-ft";
        span.innerText = `${parseInt(count).toLocaleString()}`;
        label.append(span);
        blockTwo.appendChild(label);
      }

      if (attributes["PT_ENROLL"]) {
        const count =
          attributes["PT_ENROLL"] === -999 ? "0" : attributes["PT_ENROLL"];
        const label = document.createElement("calcite-label");
        label.layout = "inline-space-between";
        label.innerText = "Part time enrollment";
        const span = document.createElement("span");
        span.id = "detail-pt";
        span.innerText = `${parseInt(count).toLocaleString()}`;
        label.append(span);
        blockTwo.appendChild(label);
      }

      const label = document.createElement("calcite-label");
      label.layout = "inline-space-between";
      label.innerText = "Offers housing";
      const span = document.createElement("span");
      span.id = "detail-housing";
      span.innerText = `${
        parseInt(attributes["DORM_CAP"]) !== -999 ? "Yes" : "No"
      }`;
      label.append(span);
      blockThree.appendChild(label);

      const labelCapacity = document.createElement("calcite-label");
      labelCapacity.layout = "inline-space-between";
      labelCapacity.innerText = "Dormitory capacity";
      const spanCapacity = document.createElement("span");
      spanCapacity.id = "detail-housing-capac";
      spanCapacity.innerText = `${
        parseInt(attributes["DORM_CAP"]) !== -999
          ? parseInt(attributes["DORM_CAP"]).toLocaleString()
          : "N/A"
      }`;

      labelCapacity.append(spanCapacity);
      blockThree.appendChild(labelCapacity);

      const labelAddress = document.createElement("calcite-label");
      labelAddress.layout = "inline-space-between";
      labelAddress.innerText = "Street Address";
      const spanAddress = document.createElement("span");
      spanAddress.id = "detail-address";
      spanAddress.innerText = `${handleCasing(
        attributes["ADDRESS"]
      )}, ${handleCasing(attributes["CITY"])}, ${attributes["STATE"]}`;
      labelAddress.append(spanAddress);
      blockFour.appendChild(labelAddress);

      const labelWebsite = document.createElement("calcite-label");
      labelWebsite.layout = "inline-space-between";
      labelWebsite.innerText = "Website";
      const spanWebsite = document.createElement("span");
      spanWebsite.id = "detail-website";
      spanWebsite.innerText = `${attributes["WEBSITE"]}`;
      labelWebsite.append(spanWebsite);
      blockFour.appendChild(labelWebsite);

      const labelPhone = document.createElement("calcite-label");
      labelPhone.layout = "inline-space-between";
      labelPhone.innerText = "Phone Number";
      const spanPhone = document.createElement("span");
      spanPhone.id = "detail-phone";
      spanPhone.innerText = `${attributes["TELEPHONE"]}`;
      labelPhone.append(spanPhone);
      blockFour.appendChild(labelPhone);

      panel.appendChild(div); // Add the div for the scrollbar
      /* Add the blocks into the div */
      div.appendChild(blockOne);
      div.appendChild(blockTwo);
      div.appendChild(blockThree);
      div.appendChild(blockFour);

      flowNode.appendChild(panel);
    } else {
      /* replace existing element content */
      detailPanelNode.heading = handleCasing(attributes["NAME"]);
      detailPanelNode.summary = `${handleCasing(attributes["CITY"])}, ${
        attributes["STATE"]
      }`;

      document.getElementById(
        "detail-website-link"
      ).href = `http://${attributes["WEBSITE"]}`;

      document.getElementById("overview-text").innerText = attributes[
        "overview"
      ]
        ? attributes["overview"]
        : "No overview available";

      document.getElementById(
        "detail-type"
      ).innerText = `${attributes["schoolType"]}`;

      document.getElementById("detail-total").innerText = `${parseInt(
        attributes["TOT_ENROLL"]
      ).toLocaleString()}`;

      document.getElementById("detail-ft").innerText = `${parseInt(
        attributes["FT_ENROLL"] === -999 ? "0" : attributes["FT_ENROLL"]
      ).toLocaleString()}`;

      document.getElementById("detail-pt").innerText = `${parseInt(
        attributes["PT_ENROLL"] === -999 ? "0" : attributes["PT_ENROLL"]
      ).toLocaleString()}`;

      document.getElementById("detail-housing-capac").innerText = `${
        parseInt(attributes["DORM_CAP"]) !== -999
          ? parseInt(attributes["DORM_CAP"]).toLocaleString()
          : "N/A"
      }`;
      document.getElementById("detail-housing").innerText = `${
        parseInt(attributes["DORM_CAP"]) !== -999 ? "Yes" : "No"
      }`;

      document.getElementById("detail-address").innerText = `${handleCasing(
        attributes["ADDRESS"]
      )}, ${handleCasing(attributes["CITY"])}, ${attributes["STATE"]}`;

      document.getElementById("detail-website").innerText = `${
        attributes["WEBSITE"] ? attributes["WEBSITE"] : "N/A"
      }`;

      document.getElementById("detail-phone").innerText = `${
        attributes["TELEPHONE"] ? attributes["TELEPHONE"] : "N/A"
      }`;
    }
    view.goTo(
      {
        center: [result.geometry.longitude, result.geometry.latitude],
        zoom: 13,
      },
      { duration: 400 }
    );

    getAttachment(objectId, result);
  }

  // uh probably do this elsewhere
  function handleCasing(string) {
    return string
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.substring(1))
      .join(" ");
  }

  function combineSQLStatements(where, sql, operator = "AND") {
    return where ? ` ${operator} (${sql})` : `(${sql})`;
  }

  function whereClause() {
    let where = "TOT_ENROLL > 100";

    if (appState.attendance) {
      where += combineSQLStatements(
        where,
        `TOT_ENROLL > ${appState.attendance.min}`
      );
      where += combineSQLStatements(
        where,
        `TOT_ENROLL < ${appState.attendance.max}`
      );
    }

    if (appState.housing?.enabled) {
      where += combineSQLStatements(where, `HOUSING=1`);
      where += combineSQLStatements(
        where,
        `DORM_CAP > ${appState.housing.min}`
      );
      where += combineSQLStatements(
        where,
        `DORM_CAP < ${appState.housing.max}`
      );
    }

    if (appState.activeProgramTypes.length > 0) {
      let schoolWhere = "";
      const values = appState.activeProgramTypes.flat();
      values.forEach(
        (value) =>
          (schoolWhere += combineSQLStatements(
            schoolWhere,
            `HI_OFFER = ${value}`,
            "OR"
          ))
      );
      where += combineSQLStatements(where, schoolWhere);
    }

    const schoolTypeValue = schoolTypeNode.value;
    if (schoolTypeValue && schoolTypeValue !== appConfig.defaultSchoolType) {
      const values = schoolTypeValue.split(",");
      let schoolWhere = "";
      values.forEach(
        (value) =>
          (schoolWhere += combineSQLStatements(
            schoolWhere,
            `NAICS_CODE = ${value}`,
            "OR"
          ))
      );
      where += combineSQLStatements(where, schoolWhere);
    }

    return where;
  }

  function resetFilters() {
    schoolTypeNode.value = appConfig.defaultSchoolType;
    appState.attendance = { ...appConfig.attendance };
    attendanceNode.minValue = appConfig.attendance.min;
    attendanceNode.maxValue = appConfig.attendance.max;
    appState.housing = { ...appConfig.housing };
    housingSectionNode.open = appConfig.housing.enabled;
    housingNode.minValue = appConfig.housing.min;
    housingNode.maxValue = appConfig.housing.max;
    appState.activeProgramTypes = [];
    [...document.querySelectorAll(`[data-type*="type"]`)].forEach(
      (item) => (item.color = "grey")
    );
    appState.hasFilterChanges = false;
    queryItems();
  }

  function filterMap() {
    if (!collegeLayerView) {
      return;
    }

    const where = whereClause();

    collegeLayerView.featureEffect = {
      filter: {
        where: where,
      },
      excludedEffect: "grayscale(80%) opacity(30%)",
    };
  }

  function displayNoResult() {
    const notice = document.createElement("calcite-notice");
    notice.active = true;
    notice.width = "full";

    const message = document.createElement("span");
    message.slot = "message";
    message.innerText = "Reset filters or move the map";

    const title = document.createElement("span");
    title.slot = "title";
    title.innerText = "No results in view";

    notice.appendChild(title);
    notice.appendChild(message);
    resultsNode.appendChild(notice);
  }

  function displayResult(result) {
    const attributes = result.attributes;
    const itemButton = document.createElement("button");
    itemButton.className = "item-button";
    const item = document.createElement("calcite-card");
    itemButton.appendChild(item);

    if (parseInt(attributes["DORM_CAP"]) !== -999) {
      const chip = document.createElement("calcite-chip");
      chip.icon = "locator";
      chip.slot = "footer-trailing";
      chip.scale = "s";
      chip.innerText = "Housing";
      item.appendChild(chip);
    }

    const chipState = document.createElement("calcite-chip");
    chipState.slot = "footer-leading";
    chipState.scale = "s";
    chipState.icon = "group";
    chipState.innerText = attributes["sizeRange"];
    item.appendChild(chipState);

    const title = document.createElement("span");
    title.slot = "title";
    title.innerText = handleCasing(attributes["NAME"]);

    const summary = document.createElement("span");
    summary.slot = "subtitle";
    summary.innerText = handleCasing(attributes["NAICS_DESC"]);

    item.appendChild(title);
    item.appendChild(summary);

    itemButton.addEventListener("click", () =>
      resultClickHandler(result.attributes[collegeLayer.objectIdField])
    );

    resultsNode.appendChild(itemButton);
  }

  async function queryItems(start = 0) {
    resetNode.hidden = !appState.hasFilterChanges;
    resetNode.indicator = appState.hasFilterChanges;

    if (!collegeLayerView) {
      return;
    }

    resultBlockNode.loading = true;

    const where = whereClause();

    collegeLayerView.featureEffect = {
      filter: {
        where: where,
      },
      excludedEffect: "grayscale(80%) opacity(30%)",
    };

    await whenFalseOnce(collegeLayerView, "updating");

    if (start === 0) {
      appState.count = await collegeLayerView.queryFeatureCount({
        geometry: view.extent.clone(),
        where,
      });
      paginationNode.total = appState.count;
      paginationNode.start = 1;
    }

    paginationNode.hidden = appState.count <= appConfig.pageNum;

    const results = await collegeLayerView.queryFeatures({
      start,
      num: appConfig.pageNum,
      geometry: view.extent.clone(),
      where: whereClause(),
      outFields: [
        ...appConfig.collegeLayerOutFields,
        collegeLayer.objectIdField,
      ],
    });

    resultBlockNode.loading = false;

    resultBlockNode.summary = `${appState.count} universities found within the map.`;

    resultsNode.innerHTML = "";
    if (results.features.length) {
      results.features.map((result) => displayResult(result));
    } else {
      displayNoResult();
    }
  }

  const map = new WebMap({
    portalItem: {
      id: appConfig.webmap,
    },
  });

  const view = new MapView({
    container: "viewDiv",
    map,
    highlightOptions: {
      fillOpacity: 0,
      haloColor: "#D0D0D0",
    },
  });

  /* Firefly tile layer for basemap use */
  const fireflyBasemap = new TileLayer({
    url: "https://fly.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Firefly/MapServer"
  });
  map.add(fireflyBasemap);
  // Turn off visibility for light mode
  fireflyBasemap.visible = false;

  view.ui.add(
    new Home({
      view,
    }),
    "top-left"
  );

  view.ui.move("zoom", "top-left");

  const search = new Search({
    view,
    resultGraphicEnabled: false,
    popupEnabled: false,
  });

  const searchExpand = new Expand({
    view,
    content: search,
  });

  view.ui.add(searchExpand, "top-left");

  const legend = new Legend({
    view,
  });

  const legendExpand = new Expand({
    view,
    content: legend,
  });

  view.ui.add(legendExpand, "top-left");

  await view.when();

  const collegeLayer = view.map.layers.find(
    (layer) => layer.url === appConfig.collegeLayerUrl
  );

  if (!collegeLayer) {
    return;
  }

  await collegeLayer.load();

  collegeLayer.outFields = [
    ...appConfig.collegeLayerOutFields,
    collegeLayer.objectIdField,
  ];
  const collegeLayerView = await view.whenLayerView(collegeLayer);

  // View clicking
  view.on("click", async (event) => {
    const response = await view.hitTest(event);

    const results = response.results.filter(
      (result) =>
        result.graphic.sourceLayer?.id === collegeLayer.id &&
        !result.graphic.isAggregate
    );

    if (!results.length) {
      return;
    }

    const graphic = results[0].graphic;

    resultClickHandler(graphic.attributes[collegeLayer.objectIdField]);
  });

  // Attendance
  attendanceNode.min = appConfig.attendance.min;
  attendanceNode.max = appConfig.attendance.max;
  attendanceNode.minValue = appConfig.attendance.min;
  attendanceNode.maxValue = appConfig.attendance.max;
  attendanceNode.addEventListener("calciteSliderInput", (event) => {
    appState.attendance.min = event.target.minValue;
    appState.attendance.max = event.target.maxValue;
    appState.hasFilterChanges = true;
    filterMap();
  });
  attendanceNode.addEventListener("calciteSliderChange", (event) => {
    appState.attendance.min = event.target.minValue;
    appState.attendance.max = event.target.maxValue;
    appState.hasFilterChanges = true;
    queryItems();
  });
  // Housing
  housingSectionNode.open = appConfig.housing.enabled;
  housingSectionNode.addEventListener("calciteBlockSectionToggle", (event) => {
    appState.housing.enabled = event.target.open;
    appState.hasFilterChanges = true;
    queryItems();
  });
  housingNode.min = appConfig.housing.min;
  housingNode.max = appConfig.housing.max;
  housingNode.minValue = appConfig.housing.min;
  housingNode.maxValue = appConfig.housing.max;
  housingNode.addEventListener("calciteSliderInput", (event) => {
    appState.housing.min = event.target.minValue;
    appState.housing.max = event.target.maxValue;
    appState.hasFilterChanges = true;
    filterMap();
  });
  housingNode.addEventListener("calciteSliderChange", (event) => {
    appState.housing.min = event.target.minValue;
    appState.housing.max = event.target.maxValue;
    appState.hasFilterChanges = true;
    queryItems();
  });

  // School type select
  for (const [key, value] of Object.entries(appConfig.schoolTypes)) {
    const option = document.createElement("calcite-option");
    option.value = value.join(",");
    option.innerText = key;
    schoolTypeNode.appendChild(option);
  }
  schoolTypeNode.addEventListener("calciteSelectChange", () => {
    appState.hasFilterChanges = true;
    queryItems();
  });

  // Degree type chip select
  for (const [key, value] of Object.entries(appConfig.programTypes)) {
    const chip = document.createElement("calcite-chip");
    chip.tabIndex = 0;
    chip.dataset.type = "type";
    chip.value = value;
    chip.scale = "s";
    chip.innerText = key;
    chip.addEventListener("click", (event) =>
      handleMultipleChipSelection(event, value)
    );
    programTypeNode.appendChild(chip);
  }

  function handleMultipleChipSelection(event, value) {
    let items = appState.activeProgramTypes;
    if (!items.includes(value)) {
      items.push(value);
      event.target.color = "blue";
    } else {
      items = items.filter((item) => item !== value);
      event.target.color = "grey";
    }
    appState.activeProgramTypes = items;
    appState.hasFilterChanges = true;
    queryItems();
  }

  // handle theme swap
  themeNode.addEventListener("click", () => handleThemeChange());

  function handleThemeChange() {
    appState.activeItem = true;
    appState.theme = appState.theme === "dark" ? "light" : "dark";
    darkThemeCss.disabled = !darkThemeCss.disabled;
    if (appState.theme === "dark") {
      // Clear the basemap, and use the firefly tile layer
      map.basemap = null;
      fireflyBasemap.visible = true;
      document.body.className = "calcite-theme-dark";
      themeNode.icon = "moon";
    } else {
      fireflyBasemap.visible = false; // Change firefly visibility for light mode
      map.basemap = "gray-vector";
      document.body.className = "";
      themeNode.icon = "brightness";
    }
    setTimeout(() => {
      appState.activeItem = false;
    }, 1000);
  }

  // Pagination
  paginationNode.num = appConfig.pageNum;
  paginationNode.start = 1;
  paginationNode.addEventListener("calcitePaginationChange", (event) => {
    queryItems(event.detail.start - 1);
  });

  // Reset button
  resetNode.addEventListener("click", () => resetFilters());

  // View extent changes
  view.watch("center", () => !appState.activeItem && queryItems());

  view.ui.add("toggle-snippet", "bottom-left");
  view.ui.add("code-snippet", "manual");

  queryItems();
}

init();
