import WebMap from "https://js.arcgis.com/4.22/@arcgis/core/WebMap.js";
import MapView from "https://js.arcgis.com/4.22/@arcgis/core/views/MapView.js";
import Home from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Home.js";
import Search from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Search.js";
import Expand from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Expand.js";

import { config } from "./config";

import { appState } from "./state";

async function init() {
  const resultsNode = document.getElementById("results");
  const attendanceNode = document.getElementById("attendance");
  const housingSectionNode = document.getElementById("housing-section");
  const housingNode = document.getElementById("housing");
  const schoolTypeNode = document.getElementById("schoolType");
  const resultBlockNode = document.getElementById("resultBlock");
  const paginationNode = document.getElementById("pagination");
  const filtersNode = document.getElementById("filters");
  const resetNode = document.getElementById("reset");
  const flowNode = document.getElementById("flow");

  // display requested item data
  // handle flow destroying dom of added panel...
  async function resultClickHandler(objectId) {
    appState.activeItem = true;

    const { features } = await collegeLayer.queryFeatures({
      returnGeometry: true,
      outSpatialReference: view.spatialReference,
      objectIds: [objectId],
      outFields: config.collegeLayerOutFields,
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
      const item = document.createElement("calcite-panel");
      item.setAttribute("heading", handleCasing(attributes["NAME"]));
      item.setAttribute(
        "summary",
        `${handleCasing(attributes["CITY"])}, ${attributes["STATE"]}`
      );
      item.setAttribute("id", "detail-panel");
      item.addEventListener("calcitePanelBackClick", async () => {
        if (appState.savedExtent) {
          await view.goTo(appState.savedExtent);
          appState.savedExtent = null;
        }
        appState.activeItem = false;
        filtersNode.disabled = false;
      });

      const block = document.createElement("calcite-block");
      block.setAttribute("open", true);

      const image = document.createElement("img");
      image.src = "https://via.placeholder.com/100";
      image.style.width = "100%";
      block.appendChild(image);

      if (attributes["WEBSITE"]) {
        const websiteChip = document.createElement("calcite-chip");
        websiteChip.setAttribute("id", "detail-chip-website");
        websiteChip.innerText = `website: ${attributes["WEBSITE"]}`;
        block.appendChild(websiteChip);
      }

      if (attributes["NAICS_DESC"]) {
        const typeChip = document.createElement("calcite-chip");
        typeChip.setAttribute("id", "detail-chip-type");
        typeChip.innerText = `type of college: ${handleCasing(
          attributes["NAICS_DESC"]
        )}`;
        block.appendChild(typeChip);
      }

      if (attributes["TOT_ENROLL"]) {
        const popChip = document.createElement("calcite-chip");
        popChip.setAttribute("id", "detail-chip-pop");
        popChip.innerText = `population: ${attributes["TOT_ENROLL"]}`;
        block.appendChild(popChip);
      }

      item.appendChild(block);
      flowNode.appendChild(item);
    } else {
      detailPanelNode.setAttribute("heading", handleCasing(attributes["NAME"]));
      document.getElementById(
        "detail-chip-type"
      ).innerText = `type: ${handleCasing(attributes["NAICS_DESC"])}`;
      document.getElementById(
        "detail-chip-website"
      ).innerText = `website: ${attributes["WEBSITE"]}`;
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

  function combineSQLStatements(where, sql) {
    return where ? ` AND (${sql})` : `(${sql})`;
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

    const schoolTypeValue = schoolTypeNode.value;
    if (schoolTypeValue && schoolTypeValue !== "all") {
      where += combineSQLStatements(where, `NAICS_CODE = ${schoolTypeValue}`);
    }

    return where;
  }

  function setQuerying(value) {
    resultBlockNode.loading = value;
  }

  function resetFilters() {
    schoolTypeNode.value = "all";
    appState.attendance.min = config.attendance.min;
    appState.attendance.max = config.attendance.min;
    attendanceNode.minValue = config.attendance.min;
    attendanceNode.maxValue = config.attendance.max;
    appState.housing.enabled = config.housing.enabled;
    appState.housing.min = config.housing.min;
    appState.housing.max = config.housing.max;
    housingSectionNode.open = config.housing.enabled;
    housingNode.minValue = config.housing.min;
    housingNode.maxValue = config.housing.max;
    appState.hasFilterChanges = false;
    queryItems();
  }

  async function queryItems(start = 0) {
    resetNode.hidden = !appState.hasFilterChanges;
    resetNode.indicator = appState.hasFilterChanges;

    if (!collegeLayer) {
      return;
    }

    setQuerying(true);

    await collegeLayer.load();

    const collegeLayerView = await view.whenLayerView(collegeLayer);

    const where = whereClause();

    if (start === 0) {
      appState.count = await collegeLayer.queryFeatureCount({
        geometry: view.extent.clone(),
        where,
      });
      paginationNode.total = appState.count;
      paginationNode.start = 1;
    }

    collegeLayerView.filter = {
      where,
    };

    paginationNode.hidden = appState.count <= config.pageNum;

    const results = await collegeLayer.queryFeatures({
      start,
      num: config.pageNum,
      geometry: view.extent.clone(),
      where: whereClause(),
      outFields: [...config.collegeLayerOutFields, collegeLayer.objectIdField],
    });

    setQuerying(false);

    resultBlockNode.setAttribute(
      "summary",
      `${appState.count} universities found within the map.`
    );

    resultsNode.innerHTML = "";
    results.features.map((result) => {
      const attributes = result.attributes;
      const item = document.createElement("calcite-card");

      if (parseInt(attributes["DORM_CAP"]) !== -999) {
        const chipDorm = document.createElement("calcite-chip");
        chipDorm.setAttribute("icon", "locator");
        chipDorm.setAttribute("slot", "footer-trailing");
        chipDorm.setAttribute("scale", "s");
        chipDorm.innerText = "Dorm";
        item.appendChild(chipDorm);
      }

      const chipPopulation = document.createElement("calcite-chip");
      const populationLevel =
        attributes["TOT_ENROLL"] > 15000
          ? "Large"
          : attributes["TOT_ENROLL"] > 5000
          ? "Medium"
          : "Small";
      chipPopulation.setAttribute("icon", "users");
      chipPopulation.setAttribute("slot", "footer-trailing");
      chipPopulation.setAttribute("scale", "s");
      chipPopulation.innerText = populationLevel;
      item.appendChild(chipPopulation);

      const chipState = document.createElement("calcite-chip");
      chipState.setAttribute("icon", "gps-on");
      chipState.setAttribute("slot", "footer-leading");
      chipState.setAttribute("scale", "s");
      chipState.innerText = attributes["STATE"];
      item.appendChild(chipState);

      const title = document.createElement("span");
      title.setAttribute("slot", "title");
      title.innerText = handleCasing(attributes["NAME"]);

      const avatar = document.createElement("calcite-avatar");
      avatar.setAttribute("scale", "s");
      avatar.setAttribute("username", attributes["NAME"].slice(0, 2));
      title.insertAdjacentElement("afterbegin", avatar);

      const summary = document.createElement("span");
      summary.setAttribute("slot", "subtitle");
      summary.innerText = handleCasing(attributes["NAICS_DESC"]);

      item.appendChild(title);
      item.appendChild(summary);

      // add listener to display data on list item click
      item.addEventListener("click", () => {
        appState.savedExtent = view.extent.clone();
        resultClickHandler(result.attributes[collegeLayer.objectIdField]);
      });
      item.addEventListener("click", (e) =>
        e.target.setAttribute("selected", true)
      );

      resultsNode.appendChild(item);
    });
  }

  const map = new WebMap({
    portalItem: {
      id: "8e3d0497739a4c819d086ab59c3912d5",
    },
  });

  const view = new MapView({
    container: "viewDiv",
    map,
    padding: {
      left: 340,
    },
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

  await view.when();

  const collegeLayer = view.map.layers.find(
    (layer) => layer.url === config.collegeLayerUrl
  );

  view.on("click", async (event) => {
    const response = await view.hitTest(event);

    const results = response.results.filter(
      (result) =>
        result.graphic.sourceLayer.id === collegeLayer.id &&
        !result.graphic.isAggregate
    );

    if (!results.length) {
      return;
    }

    const graphic = results[0].graphic;

    resultClickHandler(graphic.attributes[collegeLayer.objectIdField]);
  });

  attendanceNode.min = config.attendance.min;
  attendanceNode.max = config.attendance.max;
  attendanceNode.minValue = config.attendance.min;
  attendanceNode.maxValue = config.attendance.max;
  attendanceNode.addEventListener("calciteSliderChange", (event) => {
    appState.attendance.min = event.target.minValue;
    appState.attendance.max = event.target.maxValue;
    appState.hasFilterChanges = true;
    queryItems();
  });

  housingSectionNode.open = config.housing.enabled;
  housingSectionNode.addEventListener("calciteBlockSectionToggle", (event) => {
    appState.housing.enabled = event.target.open;
    appState.hasFilterChanges = true;
    queryItems();
  });

  housingNode.min = config.housing.min;
  housingNode.max = config.housing.max;
  housingNode.minValue = config.housing.min;
  housingNode.maxValue = config.housing.max;
  housingNode.addEventListener("calciteSliderChange", (event) => {
    appState.housing.min = event.target.minValue;
    appState.housing.max = event.target.maxValue;
    appState.hasFilterChanges = true;
    queryItems();
  });

  for (const [key, value] of Object.entries(config.schoolTypes)) {
    const option = document.createElement("calcite-option");
    option.value = key;
    option.innerText = value;
    schoolTypeNode.appendChild(option);
  }

  schoolTypeNode.addEventListener("calciteSelectChange", () => {
    appState.hasFilterChanges = true;
    queryItems();
  });

  paginationNode.num = config.pageNum;
  paginationNode.start = 1;
  paginationNode.addEventListener("calcitePaginationChange", (event) => {
    queryItems(event.detail.start - 1);
  });

  resetNode.addEventListener("click", () => resetFilters());

  view.watch("center", () => !appState.activeItem && queryItems());

  queryItems();
}

init();
