// ============================================================
// DATA LOADER - Abstraction layer for CSV / future API
// Change MODE to 'api' when the API layer is ready
// ============================================================
const DataLoader = {
  MODE: 'csv',
  API_URL: '',

  _state: {
    pipelineData: [],
    normalityMap: {},
    lastLoaded: null
  },

  async loadAll() {
    const [pipeline, normality] = await Promise.all([
      this.loadPipelineData(),
      this.loadNormalityData()
    ]);
    this._state.lastLoaded = new Date();
    return { pipeline, normality };
  },

  async loadPipelineData() {
    if (this.MODE === 'csv') {
      const text = await fetch('data/CK_math_pipeline_data.csv').then(r => {
        if (!r.ok) throw new Error('CSV fetch failed');
        return r.text();
      });
      this._state.pipelineData = Papa.parse(text, {
        header: true, skipEmptyLines: true,
        transformHeader: h => h.trim().replace(/^\uFEFF/, '')
      }).data;
      return this._state.pipelineData;
    }
    // Future API mode
    // const resp = await fetch(this.API_URL + '/pipeline?customer=cloverkey');
    // this._state.pipelineData = await resp.json();
    // return this._state.pipelineData;
  },

  async loadNormalityData() {
    if (this.MODE === 'csv') {
      const text = await fetch('data/CK_normality_results.csv').then(r => {
        if (!r.ok) throw new Error('CSV fetch failed');
        return r.text();
      });
      const rows = Papa.parse(text, {
        header: true, skipEmptyLines: true,
        transformHeader: h => h.trim().replace(/^\uFEFF/, '')
      }).data;
      rows.forEach(r => {
        this._state.normalityMap[r.CATEG_COD + '|' + r.SUBCAT_COD] = r;
      });
      return this._state.normalityMap;
    }
  },

  async refresh() {
    this._state.pipelineData = [];
    this._state.normalityMap = {};
    return this.loadAll();
  },

  getPipelineData() { return this._state.pipelineData; },
  getNormalityMap() { return this._state.normalityMap; },
  getLastLoaded() { return this._state.lastLoaded; }
};
