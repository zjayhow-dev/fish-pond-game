# 游戏美术资源

`assets/` 是项目的美术资源与生成提示词目录。背景、角色、装饰等素材应与对应提示词和规格记录一起归档。

鱼类图谱的 30 种鱼体沿用程序化 Canvas 绘制，配置在 `code/js/fish-catalog.js`、共用绘制在 `code/js/fish-art.js`，没有新增位图或图像生成提示词；完整花色表见 `doc/鱼类图谱.md`。

```text
assets/
├── README.md
├── backgrounds/
│   └── pond-jade-v1.png     # 当前池塘背景，生成原图
├── icons/
│   └── lotus.svg           # 页面荷花图标，手工编写的矢量素材
└── prompts/
    └── pond-jade-v1.md      # 原始提示词、修订提示词与检查记录
```

## 当前资源

| 资源 | 用途 | 目标尺寸 | 实际尺寸 | 生成记录 |
|---|---|---|---|---|
| [pond-jade-v1.png](backgrounds/pond-jade-v1.png) | 正交俯视浅玉色池塘；无动物和 UI | 2560×1440 | 1672×941 | [提示词与修订](prompts/pond-jade-v1.md) |

当前图片由内置 `image_gen` 生成。工具实际返回尺寸与目标不同，保留原始输出并如实记录；未将拉伸显示或插值处理称为原生高分辨率素材。

## 使用与版本管理

- `code/css/game.css` 通过 `../../assets/backgrounds/pond-jade-v1.png` 引用背景。
- 静态部署必须一并发布根目录 `assets/`，保持相对目录结构。
- 新资源按 `用途-主题-v版本号` 命名，图片与提示词使用相同资源编号；重要修改递增版本。
- 提示词记录使用场景、构图、视角、色彩、排除项、目标尺寸、实际尺寸、生成方式与修订过程。
- 池塘背景不烘焙锦鲤、其他动物、UI 或文字，避免静态素材与动态对象混杂。
- 页面荷花图标统一存放在 `assets/icons/lotus.svg`，由 `code/index.html` 使用 `../assets/icons/lotus.svg` 引用；该 SVG 为手工编写，无生成提示词。旧截图裁切底图已删除。
