export const appConfig = {
  webmap: "8e3d0497739a4c819d086ab59c3912d5",
  defaultSchoolType: "all",
  schoolTypes: {
    Colleges: [611310],
    "Junior Colleges": [611210],
    "Other Trade Schools": [611410, 611511, 611519, 611610],
  },
  programTypes: {
    Associates: [3],
    Bachelors: [5],
    Masters: [7],
    Doctorate: [9],
    "Post-graduate certificate": [6, 8],
    "In-betweenies": [1, 2, 4],
  },
  pageNum: 25,
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
    "PT_ENROLL",
    "FT_ENROLL",
    "DORM_CAP",
    "HI_OFFER",
    "TELEPHONE",
    "overview",
    "schoolType",
    "sizeRange",
  ],
  attendance: { min: 0, max: 160000 },
  housing: { enabled: false, min: 0, max: 20000 },
};
