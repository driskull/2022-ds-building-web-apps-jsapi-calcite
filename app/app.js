import WebMap from "https://js.arcgis.com/4.22/@arcgis/core/WebMap.js";
import MapView from "https://js.arcgis.com/4.22/@arcgis/core/views/MapView.js";
import Home from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Home.js";
import Search from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Search.js";
import Expand from "https://js.arcgis.com/4.22/@arcgis/core/widgets/Expand.js";

async function init() {
  // display requested item data
  // handle flow destroying dom of added panel...
  async function resultClickHandler(objectId) {
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
        "TOT_ENROLL",
        "DORM_CAP",
      ],
    });

    const result = features[0];

    if (!result.geometry || !result.attributes) {
      return;
    }

    activeItem = true;
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
      item.addEventListener("calcitePanelBackClick", () => {
        activeItem = false;
        filterItems();
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

  async function filterItems() {
    const results = await collegeLayer.queryFeatures({
      start: 0,
      num: 10,
      geometry: view.extent.clone(),
      where: `TOT_ENROLL > 100`,
      outFields: [
        "NAICS_DESC",
        "STATE",
        "ADDRESS",
        "CITY",
        "NAME",
        "TOT_ENROLL",
        "DORM_CAP",
      ],
    });

    console.log({ results });
    // todo: setup pagination
    document
      .getElementById("resultBlock")
      .setAttribute("summary", `${results.features.length} results near blah`);
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
      "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/US_Colleges_and_Universities_view/FeatureServer"
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

    if (!results.length) {
      return;
    }

    const graphic = results[0].graphic;

    resultClickHandler(graphic.attributes[collegeLayer.objectIdField]);
  });

  let activeItem = false;

  view.watch("center", () => !activeItem && filterItems());

  filterItems();
}

init();
