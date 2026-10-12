import { createIcon } from './icons.js';

// 列宽和编辑器在 columnDefs 中；行高读取 styles.css
// 层序代表物理顺序，不能按数值排序
export function createLayerGrid(
  element,
  { materials, onEdit, onTarget, onMove, onDelete, onError },
) {
  const { createGrid, themeQuartz } = window.agGrid;
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  // 主题从 CSS 变量取色，避免选中态和页面配色分开维护
  const theme = themeQuartz.withParams({
    backgroundColor: token('--surface'),
    foregroundColor: token('--ink'),
    headerBackgroundColor: token('--soft'),
    headerTextColor: token('--ink'),
    borderColor: token('--line'),
    accentColor: token('--accent'),
    fontFamily: token('--font-family'),
    fontSize: 14,
    headerFontSize: 14,
    headerFontWeight: 500,
    wrapperBorderRadius: 0,
    rowHeight: parseInt(token('--grid-row-height')),
    headerHeight: parseInt(token('--grid-header-height')),
    cellHorizontalPadding: 12,
    columnBorder: true,
    headerColumnBorder: true,
    headerColumnBorderHeight: '100%',
    rowBorder: true,
    rowHoverColor: token('--soft'),
    selectedRowBackgroundColor: token('--selected'),
    rangeSelectionBorderColor: token('--muted'),
    autoHeightMinBodyHeight: 0,
  });

  // 行内按钮只触发对应操作，阻止点击继续交给单元格编辑器
  function actionButton(label, icon, disabled, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'row-action';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    button.appendChild(createIcon(icon));
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      callback();
    });
    return button;
  }
  let currentRows = [];
  // 厚度、n、k 共用数值列配置，提交时检查各自的下限
  const numericColumn = (field, headerName, width, min) => ({
    field,
    headerName,
    width,
    minWidth: width - 12,
    cellClass: 'numeric-cell',
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: { min },
    valueSetter: (params) => {
      const value = Number(params.newValue);
      if (
        params.newValue == null ||
        params.newValue === '' ||
        !Number.isFinite(value) ||
        value < min
      ) {
        onError(`${headerName} 必须不小于 ${min}`);
        return false;
      }
      params.data[field] = value;
      return true;
    },
  });
  // 列顺序就是桌面展示顺序，控制列不允许编辑或筛选
  const columnDefs = [
    {
      colId: 'order',
      headerName: '层',
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      editable: false,
      filter: false,
      cellClass: 'center-cell',
      headerClass: 'center-header',
      valueGetter: (params) =>
        String(currentRows.findIndex((row) => row.id === params.data.id) + 1).padStart(2, '0'),
    },
    {
      field: 'name',
      headerName: '名称',
      width: 264,
      minWidth: 148,
      flex: 1,
      cellEditor: 'agTextCellEditor',
    },
    {
      field: 'material',
      headerName: '材料',
      width: 184,
      minWidth: 160,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: Object.keys(materials) },
    },
    numericColumn('thickness', '厚度 / nm', 120, 0.01),
    numericColumn('n', 'n', 96, 0.001),
    numericColumn('k', 'k', 104, 0),
    {
      // 响应层只允许选择一个，实际模型更新由外部回调处理
      field: 'target',
      headerName: '响应层',
      width: 88,
      minWidth: 88,
      editable: false,
      filter: false,
      cellClass: 'control-cell',
      headerClass: 'center-header',
      cellRenderer: (params) => {
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'response-layer';
        radio.checked = params.data.target;
        radio.setAttribute('aria-label', `${params.data.name} 设为响应层`);
        radio.addEventListener('click', (event) => {
          event.stopPropagation();
          onTarget(params.data.id);
        });
        return radio;
      },
    },
    {
      // 顶部层不能再上移，底部层不能再下移，至少保留一层
      colId: 'actions',
      headerName: '操作',
      width: 136,
      minWidth: 136,
      editable: false,
      filter: false,
      cellClass: 'control-cell',
      headerClass: 'center-header',
      cellRenderer: (params) => {
        const group = document.createElement('div');
        group.className = 'row-actions';
        const index = currentRows.findIndex((row) => row.id === params.data.id);
        group.append(
          actionButton(`上移 ${params.data.name}`, 'ArrowUp', index === 0, () =>
            onMove(params.data.id, 1),
          ),
          actionButton(
            `下移 ${params.data.name}`,
            'ArrowDown',
            index === currentRows.length - 1,
            () => onMove(params.data.id, -1),
          ),
          actionButton(`删除 ${params.data.name}`, 'Trash', currentRows.length === 1, () =>
            onDelete(params.data.id),
          ),
        );
        return group;
      },
    },
  ];
  // 编辑器和筛选沿用 AG Grid，非法输入会留在原单元格等待修正
  const api = createGrid(element, {
    theme,
    columnDefs,
    rowData: [],
    domLayout: 'autoHeight',
    defaultColDef: {
      editable: true,
      sortable: false,
      resizable: true,
      filter: true,
      floatingFilter: false,
      cellDataType: false,
      suppressMovable: true,
    },
    getRowId: (params) => params.data.id,
    rowClassRules: { 'response-row': (params) => params.data.target },
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    invalidEditValueMode: 'block',
    suppressCellFocus: false,
    animateRows: false,
    icons: {
      filter: () => createIcon('EllipsisVertical'),
      menu: () => createIcon('EllipsisVertical'),
    },
    // 表格内置菜单使用中文，业务按钮文案在上面的列配置中
    localeText: {
      noRowsToShow: '没有匹配的层',
      filterOoo: '筛选…',
      contains: '包含',
      notContains: '不包含',
      equals: '等于',
      notEqual: '不等于',
      startsWith: '开头是',
      endsWith: '结尾是',
      blank: '空白',
      notBlank: '非空',
      andCondition: '并且',
      orCondition: '或者',
      applyFilter: '应用',
      resetFilter: '重置',
      clearFilter: '清除',
    },
    onCellValueChanged: (event) => onEdit(event.data.id, event.colDef.field, event.newValue),
  });
  const smallScreen = window.matchMedia('(max-width: 700px)');
  // 手机优先展示层序、名称和厚度，宽度变化时同步调整名称列
  function orderColumns() {
    const order = smallScreen.matches
      ? ['order', 'name', 'thickness', 'material', 'n', 'k', 'target', 'actions']
      : ['order', 'name', 'material', 'thickness', 'n', 'k', 'target', 'actions'];
    api.applyColumnState({
      state: order.map((colId) => ({
        colId,
        // 手机首屏完整显示“层 / 名称 / 厚度”；其余列在表格内横向滚动
        ...(colId === 'name'
          ? {
              width: smallScreen.matches ? Math.max(148, element.clientWidth - 170) : 264,
              flex: smallScreen.matches ? null : 1,
            }
          : {}),
      })),
      applyOrder: true,
    });
  }
  smallScreen.addEventListener('change', orderColumns);
  orderColumns();
  new ResizeObserver(() => {
    if (smallScreen.matches) orderColumns();
  }).observe(element);
  // 无效数值会阻止提交；焦点移出表格后仍允许 Esc 取消
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && api.getEditingCells().length) api.stopEditing(true);
    },
    true,
  );
  // 只向页面暴露层数据更新和编辑提交、取消三个操作
  return {
    setLayers(layers) {
      // 表格从金属侧往下排，求解器从衬底侧往上算，副本用于隔离未提交的编辑
      currentRows = [...layers].reverse().map((layer) => ({ ...layer }));
      api.setGridOption('rowData', currentRows);
      api.refreshCells({ force: true });
    },
    commitEdit() {
      api.stopEditing();
      return api.getEditingCells().length === 0;
    },
    cancelEdit() {
      api.stopEditing(true);
    },
  };
}
