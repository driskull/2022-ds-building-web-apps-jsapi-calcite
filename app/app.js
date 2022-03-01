import WebMap from "https://js.arcgis.com/4.22/@arcgis/core/WebMap.js";
import MapView from "https://js.arcgis.com/4.22/@arcgis/core/views/MapView.js";
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

    filtersNode.disabled = true;
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
        filtersNode.disabled = false;
      });

      const block = document.createElement("calcite-block");
      block.open = true;

      const image = document.createElement("img");
      image.src = "https://via.placeholder.com/100";
      image.style.width = "100%";
      block.appendChild(image);

      if (attributes["WEBSITE"]) {
        const itemWebsite = document.createElement("calcite-button");
        itemWebsite.id = "detail-item-website";
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

      if (attributes["NAICS_DESC"]) {
        const typeChip = document.createElement("calcite-chip");
        typeChip.id = "detail-chip-type";
        typeChip.innerText = `type of college: ${handleCasing(
          attributes["NAICS_DESC"]
        )}`;
        block.appendChild(typeChip);
      }

      if (attributes["TOT_ENROLL"]) {
        const popChip = document.createElement("calcite-chip");
        popChip.id = "detail-chip-pop";
        popChip.innerText = `population: ${attributes["TOT_ENROLL"]}`;
        block.appendChild(popChip);
      }

      panel.appendChild(block);
      flowNode.appendChild(panel);
    } else {
      detailPanelNode.heading = handleCasing(attributes["NAME"]);
      document.getElementById(
        "detail-chip-type"
      ).innerText = `type: ${handleCasing(attributes["NAICS_DESC"])}`;
      document.getElementById("detail-item-website").innerText = `Learn more`;
      document.getElementById(
        "detail-item-website"
      ).href = `http://${attributes["WEBSITE"]}`;

      document.getElementById(
        "detail-chip-pop"
      ).innerText = `population: ${attributes["POPULATION"]}`;
    }
    view.goTo(
      {
        center: [result.geometry.longitude, result.geometry.latitude],
        zoom: 13,
      },
      { duration: 400 }
    );
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
    appState.attendance = appConfig.attendance;
    attendanceNode.minValue = appConfig.attendance.min;
    attendanceNode.maxValue = appConfig.attendance.max;
    appState.housing = appConfig.housing;
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

  async function queryItems(start = 0) {
    resetNode.hidden = !appState.hasFilterChanges;
    resetNode.indicator = appState.hasFilterChanges;

    if (!collegeLayerView) {
      return;
    }

    resultBlockNode.loading = true;

    const where = whereClause();

    collegeLayerView.featureEffect  = {
      filter: {
        where: where
      },
      excludedEffect: "grayscale(80%) opacity(30%)"
    };

    await whenFalseOnce(collegeLayerView, "updating");

    if (start === 0) {
      appState.count = await collegeLayerView.queryFeatureCount({
        where,
      });
      paginationNode.total = appState.count;
      paginationNode.start = 1;
    }

    paginationNode.hidden = appState.count <= appConfig.pageNum;

    const results = await collegeLayerView.queryFeatures({
      start,
      num: appConfig.pageNum,
      where: whereClause(),
      outFields: [
        ...appConfig.collegeLayerOutFields,
        collegeLayer.objectIdField,
      ],
    });

    resultBlockNode.loading = false;

    resultBlockNode.summary = `${appState.count} universities found within the map.`;

    resultsNode.innerHTML = "";
    results.features.map((result) => {
      const attributes = result.attributes;
      const itemButton = document.createElement("button");
      itemButton.className = "item-button";
      const item = document.createElement("calcite-card");
      itemButton.appendChild(item);

      if (parseInt(attributes["DORM_CAP"]) !== -999) {
        const chipDorm = document.createElement("calcite-chip");
        chipDorm.icon = "locator";
        chipDorm.slot = "footer-trailing";
        chipDorm.scale = "s";
        chipDorm.innerText = "Housing";
        item.appendChild(chipDorm);
      }

      const chipState = document.createElement("calcite-chip");
      chipState.slot = "footer-leading";
      chipState.scale = "s";
      chipState.innerText = attributes["STATE"];
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
    });
  }

  const map = new WebMap({
    portalItem: {
      id: appConfig.webmap,
    },
  });

  const view = new MapView({
    container: "viewDiv",
    map,
  });

  view.ui.add(
    new Home({
      view,
    }),
    "top-left"
  );

  view.ui.move("zoom", "top-left");

  const search = new Search({
    view,
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

  queryItems();
}

init();
