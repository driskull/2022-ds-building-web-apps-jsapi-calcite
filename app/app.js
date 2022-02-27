import WebMap from "https://js.arcgis.com/4.22/@arcgis/core/WebMap.js";
import MapView from "https://js.arcgis.com/4.22/@arcgis/core/views/MapView.js";
import Home from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Home.js";
import Search from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Search.js";
import Expand from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Expand.js";

const pageNum = 10;

const schoolTypes = {
  611110: "Elementary and Secondary Schools",
  611210: "Junior Colleges",
  611310: "Colleges",
  611410: "Business and Secretarial Schools",
  611420: "Computer Training",
  611430: "Professional and Management Development Training",
  611511: "Cosmetology and Barber Schools",
  611512: "Flight Training",
  611513: "Apprenticeship Training",
  611519: "Other Technical and Trade Schools",
  611610: "Fine Arts Schools",
  611620: "Sports and Recreation Instruction",
  611630: "Language Schools",
  611691: "Exam Preparation and Tutoring",
  611692: "Automobile Driving Schools",
  611699: "All Other Miscellaneous Schools and Instruction",
  611710: "Educational Support Services",
};

async function init() {
  // display requested item data
  // handle flow destroying dom of added panel...
  async function resultClickHandler(objectId) {
    savedExtent = view.extent.clone();
    savedStart = paginationNode.start - 1;
    const { features } = await collegeLayer.queryFeatures({
      returnGeometry: true,
      outSpatialReference: view.spatialReference,
      objectIds: [objectId],
      outFields: [
        "NAICS_DESC",
        "STATE",
        "ADDRESS",
        "CITY",
        "NAME",
        "WEBSITE",
        "TOT_ENROLL",
        "DORM_CAP",
      ],
    });

    const result = features[0];

    if (!result.geometry || !result.attributes) {
      return;
    }

    activeItem = true;
    filtersNode.disabled = true;
    const attributes = result.attributes;
    const panelExists = document.getElementById("detail-panel");
    // a janky way to replace content in a single panel vs appending entire new one each time
    if (!panelExists) {
      const item = document.createElement("calcite-panel");
      item.setAttribute("heading", handleCasing(attributes["NAME"]));
      item.setAttribute(
        "summary",
        `${handleCasing(attributes["CITY"])}, ${attributes["STATE"]}`
      );
      item.setAttribute("id", "detail-panel");
      item.addEventListener("calcitePanelBackClick", async () => {
        await view.goTo(savedExtent);
        savedExtent = null;
        activeItem = false;
        filtersNode.disabled = false;
        queryItems(savedStart);
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
      document.getElementById("flow").appendChild(item);
    } else {
      document
        .getElementById("detail-panel")
        .setAttribute("heading", handleCasing(attributes["NAME"]));
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

    if (attendance) {
      where += combineSQLStatements(where, `TOT_ENROLL > ${attendance.min}`);
      where += combineSQLStatements(where, `TOT_ENROLL < ${attendance.max}`);
    }

    if (housing?.enabled) {
      where += combineSQLStatements(where, `HOUSING=1`);
      where += combineSQLStatements(where, `DORM_CAP > ${housing.min}`);
      where += combineSQLStatements(where, `DORM_CAP < ${housing.max}`);
    }

    const schoolTypeValue = schoolTypeNode.value;
    if (schoolTypeValue && schoolTypeValue !== "all") {
      where += combineSQLStatements(where, `NAICS_CODE = ${schoolTypeValue}`);
    }

    return where;
  }

  function setQuerying(value) {
    resultBlock.loading = value;
  }

  async function queryItems(start = 0) {
    if (!collegeLayer) {
      return;
    }

    setQuerying(true);

    await collegeLayer.load();

    if (start === 0) {
      count = await collegeLayer.queryFeatureCount({
        geometry: view.extent.clone(),
        where: whereClause(),
      });
      paginationNode.total = count;
      paginationNode.start = 1;
    }

    paginationNode.hidden = count <= pageNum;

    const results = await collegeLayer.queryFeatures({
      start,
      num: pageNum,
      geometry: view.extent.clone(),
      where: whereClause(),
      outFields: [
        "NAICS_DESC",
        "STATE",
        "ADDRESS",
        "CITY",
        "NAME",
        "TOT_ENROLL",
        "WEBSITE",
        "DORM_CAP",
        collegeLayer.objectIdField,
      ],
    });

    console.log({ results });

    setQuerying(false);

    // todo: setup pagination
    resultBlock.setAttribute(
      "summary",
      `${count} universities found within the map.`
    );
    // todo should filter existing not wholesale zero out and replace...
    document.getElementById("results").innerHTML = "";
    // temp only show 100 - rendering like this not functioning well
    results.features
      .slice(0, 99)
      .sort((a, b) => a.attributes["NAME"].localeCompare(b.attributes["NAME"]))
      .map((result) => {
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
        item.addEventListener("click", () =>
          resultClickHandler(result.attributes[collegeLayer.objectIdField])
        );
        item.addEventListener("click", (e) =>
          e.target.setAttribute("selected", true)
        );

        document.getElementById("results").appendChild(item);
      });
  }

  const map = new WebMap({
    portalItem: {
      // autocasts as new PortalItem()
      id: "8e3d0497739a4c819d086ab59c3912d5",
    },
  });

  const view = new MapView({
    container: "viewDiv",
    map,
    // to do set the width of panel w css var as constant
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
    (layer) =>
      layer.url ===
      "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/US_Colleges_and_Universities/FeatureServer"
  );

  console.log({ collegeLayer });

  // handle click on map point
  view.on("click", async (event) => {
    const response = await view.hitTest(event);

    const results = response.results.filter(
      (result) =>
        result.graphic.sourceLayer.id === collegeLayer.id &&
        !result.graphic.isAggregate
    );

    console.log(results);

    if (!results.length) {
      return;
    }

    const graphic = results[0].graphic;

    resultClickHandler(graphic.attributes[collegeLayer.objectIdField]);
  });

  const attendance = { min: 0, max: 160000 };
  const attendanceNode = document.getElementById("attendance");
  attendanceNode.min = attendance.min;
  attendanceNode.max = attendance.max;
  attendanceNode.minValue = attendance.min;
  attendanceNode.maxValue = attendance.max;
  attendanceNode.addEventListener("calciteSliderChange", (event) => {
    attendance.min = event.target.minValue;
    attendance.max = event.target.maxValue;
    queryItems();
  });

  const housing = { enabled: false, min: 0, max: 20000 };
  const housingSectionNode = document.getElementById("housing-section");
  housingSectionNode.open = housing.enabled;
  housingSectionNode.addEventListener("calciteBlockSectionToggle", (event) => {
    housing.enabled = event.target.open;
    queryItems();
  });
  const housingNode = document.getElementById("housing");
  housingNode.min = housing.min;
  housingNode.max = housing.max;
  housingNode.minValue = housing.min;
  housingNode.maxValue = housing.max;
  housingNode.addEventListener("calciteSliderChange", (event) => {
    housing.min = event.target.minValue;
    housing.max = event.target.maxValue;
    queryItems();
  });

  const schoolTypeNode = document.getElementById("schoolType");
  for (const [key, value] of Object.entries(schoolTypes)) {
    const option = document.createElement("calcite-option");
    option.value = key;
    option.innerText = value;
    schoolTypeNode.appendChild(option);
  }
  schoolTypeNode.addEventListener("calciteSelectChange", () => {
    queryItems();
  });

  const resultBlock = document.getElementById("resultBlock");

  let count = 0;
  let activeItem = false;
  let savedExtent = null;
  let savedStart = 0;

  const paginationNode = document.getElementById("pagination");
  paginationNode.num = pageNum;
  paginationNode.start = 1;
  paginationNode.addEventListener("calcitePaginationChange", (event) => {
    queryItems(event.detail.start - 1);
  });

  const filtersNode = document.getElementById("filters");

  view.watch("center", () => !activeItem && queryItems());

  queryItems();
}

init();
