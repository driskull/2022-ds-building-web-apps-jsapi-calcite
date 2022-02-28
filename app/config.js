export const appConfig = {
  webmap: "8e3d0497739a4c819d086ab59c3912d5",
  defaultSchoolType: "all",
  schoolTypes: {
    Colleges: [611310],
    "Junior Colleges": [611210],
    "Other Trade Schools": [611410, 611511, 611519, 611610],
  },
  pageNum: 10,
  collegeLayerUrl:
    "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/US_Colleges_and_Universities/FeatureServer",
  collegeLayerOutFields: [
    "NAICS_DESC",
    "STATE",
    "ADDRESS",
    "CITY",
    "NAME",
    "WEBSITE",
    "TOT_ENROLL",
    "DORM_CAP",
  ],
  attendance: { min: 0, max: 160000 },
  housing: { enabled: false, min: 0, max: 20000 },
};
