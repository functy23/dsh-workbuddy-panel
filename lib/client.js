window.__ModuleLoader__.load({
	id: "dsh-workbuddy-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/copy.ts
		/** Chinese table; the key domain for both. */
		const ZH = {
			"nav": "WorkBuddy2API",
			"title": "WorkBuddy2API 互通",
			"intro": "在本机管理 workbuddy2api-panel：模型列表与启停、思考档位、账号池，以及这条模型路由。",
			"versionLine": "插件版本 {0}",
			"piAiVersion": "pi-ai {0}",
			"routeOwned": "路由 {0}",
			"routeFallback": "路由 {0}（备用）",
			"routeConflict": "{0} 已被其他插件占用，本插件改用备用路由",
			"tabOverview": "概览",
			"tabModels": "模型",
			"tabAccounts": "账号",
			"tabSettings": "连接",
			"refresh": "刷新",
			"refreshing": "刷新中…",
			"lastUpdated": "更新于 {0}",
			"neverUpdated": "尚未成功读取",
			"connected": "面板已连接",
			"disconnected": "面板未连接",
			"panelVersion": "面板 v{0}",
			"uptime": "运行 {0}",
			"redis": "Redis：{0}",
			"authRequired": "面板启用了 API Key",
			"authNotRequired": "面板未启用 API Key",
			"overviewAccounts": "账号",
			"overviewHealthy": "可用",
			"overviewCooling": "冷却",
			"overviewDisabled": "已禁用",
			"overviewPaused": "已暂停",
			"overviewModels": "模型",
			"overviewModelsValue": "{0} / {1}",
			"overviewHidden": "已隐藏 {0}",
			"overviewTitle": "面板概况",
			"overviewDesc": "数字来自面板的 /panel/api/overview，与面板首页同源。",
			"quickTitle": "快捷操作",
			"quickDesc": "这些操作直接作用在面板上，执行后本页会重新读取。",
			"checkinAll": "全部账号签到",
			"balanceAll": "刷新全部余额",
			"syncHidden": "同步隐藏到面板",
			"syncHiddenHint": "把本地隐藏的模型写进面板 models.hidden，网关侧也会拒绝这些模型。",
			"modelsTitle": "模型列表",
			"modelsDesc": "开关只影响 DSH 的模型选择器；开启「同步隐藏到面板」后也会写进面板。",
			"regionCn": "国内版",
			"regionGlobal": "国际版",
			"regionFilter": "模型域",
			"regionEmpty": "这一域还没有模型；切换另一个标签，或等网关刷新后再看。",
			"regionCount": "{0} 个模型",
			"searchPlaceholder": "搜索模型 id 或名称",
			"enableAll": "全部启用",
			"disableAll": "全部停用",
			"modelEnabled": "启用",
			"modelEffort": "思考档位",
			"modelEffortDefault": "默认 {0}",
			"modelNoEffort": "不支持思考档位",
			"modelContext": "上下文 {0}",
			"modelOutput": "输出 {0}",
			"modelVision": "图片输入",
			"modelCredits": "计费 {0}",
			"modelHiddenBadge": "已隐藏",
			"modelsEmpty": "面板还没有返回模型列表",
			"modelsEmptyHint": "确认面板已启动、已添加账号，然后点刷新。",
			"accountsTitle": "账号池",
			"accountsDesc": "添加账号走面板自己的登录流程；停用/暂停只影响面板的选号，不会删除凭证。",
			"accountCredits": "{0} / {1} 积分",
			"accountCreditsOnly": "{0} 积分",
			"accountStatusActive": "可用",
			"accountStatusCooling": "冷却中",
			"accountStatusDisabled": "已禁用",
			"accountStatusPaused": "已暂停",
			"accountRealmCn": "国内",
			"accountRealmGlobal": "国际",
			"accountSuccess": "成功 {0}",
			"accountFails": "连败 {0}",
			"accountRequests": "{0} 次请求",
			"accountLastModel": "最近 {0}",
			"accountExpiry": "凭证到期 {0}",
			"accountRateLimited": "{0} 个模型限流中",
			"actionEnable": "启用",
			"actionDisable": "停用",
			"actionPause": "暂停",
			"actionResume": "恢复",
			"actionCheckin": "签到",
			"actionBalance": "刷新余额",
			"actionRemove": "移除",
			"actionRemoveConfirm": "再次点击确认移除",
			"accountsEmpty": "面板里还没有账号",
			"addTitle": "添加账号",
			"addDesc": "点「开始登录」会拿到一条登录链接，在浏览器完成授权后回到这里点「检查登录」。",
			"addRealm": "账号域",
			"addStart": "开始登录",
			"addPoll": "检查登录",
			"addCancel": "取消",
			"addOpen": "打开登录页",
			"addWaiting": "等待浏览器完成登录…",
			"importTitle": "粘贴账号 JSON 导入",
			"importDesc": "支持面板 cockpit 导出格式，或 auths/*.json 的 { auth: { accessToken, refreshToken } } 形状。",
			"importPlaceholder": "粘贴一个账号对象或数组…",
			"importButton": "导入",
			"settingsTitle": "面板连接",
			"settingsDesc": "本插件通过面板的管理 API 读取账号与模型，并用同一个地址的 /v1 提供模型路由。",
			"fieldPanelUrl": "面板地址",
			"fieldPanelUrlHint": "默认 http://127.0.0.1:7863，可带或不带 /v1。",
			"fieldApiKey": "API Key",
			"fieldApiKeyHint": "面板 config.json 里的 api_key，保存后不会回显。",
			"fieldApiKeyPlaceholder": "留空表示不修改",
			"fieldRefresh": "自动刷新间隔（秒）",
			"fieldRefreshHint": "10–600 秒，仅影响本页与侧栏卡片的读取频率。",
			"fieldSync": "隐藏模型时同步到面板",
			"fieldSyncHint": "关闭后隐藏只在 DSH 内生效，面板仍会向其他客户端提供该模型。",
			"save": "保存",
			"saving": "保存中…",
			"saved": "已保存",
			"testConnection": "测试连接",
			"testing": "测试中…",
			"testOk": "连接正常（{0} 个账号）",
			"fieldProviderId": "路由 id",
			"fieldProviderIdHint": "模型选择器里显示的 provider，默认 workbuddy2api。",
			"errorPrefix": "失败：",
			"loginUrlLabel": "登录链接",
			"copy": "复制",
			"copied": "已复制",
			"showKey": "显示",
			"hideKey": "隐藏",
			"panelCardTitle": "WorkBuddy2API",
			"panelCardAccounts": "{0}/{1} 账号可用",
			"panelCardModels": "{0}/{1} 模型启用",
			"panelCardOffline": "面板未连接",
			"panelTitle": "WorkBuddy2API 面板",
			"panelSubtitle": "本机 workbuddy2api-panel 的模型与账号",
			"panelClose": "返回会话",
			"panelManage": "打开设置",
			"panelRefresh": "刷新",
			"panelAccountsTitle": "账号池",
			"panelModelsTitle": "模型",
			"panelNoAccounts": "面板里还没有账号",
			"panelNoModels": "还没有模型列表",
			"panelHidden": "已隐藏",
			"poolCredits": "剩余额度",
			"creditsOf": "{0} / {1}",
			"creditsLabel": "积分",
			"creditsTotal": "上限 {0}",
			"accountSuccessLabel": "成功次数",
			"accountFailsLabel": "连败",
			"accountNoCheckin": "未签到",
			"gatewayTitle": "网关进程",
			"gatewayDesc": "网关进程由 DSH 宿主组合托管，面板只读状态；服务端单独下载，不再随插件包发布。",
			"gatewayStateRunning": "运行中",
			"gatewayStateStarting": "启动中",
			"gatewayStateStopped": "已停止",
			"gatewayStateExternal": "外部实例",
			"gatewayStateFailed": "启动失败",
			"gatewayStateServerMissing": "服务端未安装",
			"gatewayStateServerInvalid": "服务端校验失败",
			"gatewayStateHostUnavailable": "宿主进程服务不可用",
			"gatewayStatePortConflict": "端口被占用",
			"gatewayManaged": "由 DSH 宿主托管",
			"gatewayServerVersion": "服务端 {0}",
			"gatewayStart": "启动",
			"gatewayStop": "停止",
			"gatewayRestart": "重启",
			"gatewayLog": "最近输出",
			"gatewayLogEmpty": "还没有输出",
			"gatewayRestarts": "已自动重启 {0} 次",
			"gatewayExternalHint": "这个网关不是由本宿主行拉起的：状态与目录照常可用，停止请在原处操作。",
			"gatewayBinaryHint": "来自服务端缓存，SHA-256 校验通过后才会运行。",
			"gatewayBinary": "可执行文件",
			"gatewayWorkdir": "工作目录",
			"gatewayConfig": "配置文件",
			"serverTitle": "服务端",
			"serverDesc": "网关本体单独下载，不随插件包发布；校验通过后由宿主进程托管。",
			"serverStateMissing": "未安装",
			"serverStateReady": "已安装",
			"serverStateDownloading": "下载中",
			"serverStateVerifying": "校验中",
			"serverStateInstalling": "安装中",
			"serverStateFailed": "下载失败",
			"serverStateCancelled": "已取消",
			"serverStateUnsupported": "当前平台没有构建",
			"serverDownload": "下载服务端",
			"serverCancel": "取消下载",
			"serverRetry": "重试",
			"serverVerify": "重新校验",
			"serverOpenRelease": "打开下载页",
			"serverVersion": "版本",
			"serverPlatform": "平台",
			"serverDownloadSize": "下载 / 安装大小",
			"serverChecksum": "SHA-256",
			"serverPath": "安装位置",
			"serverProgress": "{0}% · {1} / {2}",
			"serverUpdateAvailable": "缓存里是 {0}，当前需要 {1}",
			"serverErrorNotFound": "服务端资产尚未发布（HTTP 404）；本地测试请使用已安装的缓存，或稍后重试。",
			"serverErrorChecksum": "服务端校验失败，请重新下载。",
			"serverManualHint": "离线安装：把 .gz 解压到上面的版本目录，文件名保持 workbuddy2api，然后点“重新校验”。",
			"serverPanelUpdateHint": "面板更新走 DSH 插件管理器；内核可以在下面的“内核更新”里单独检查与安装，不必等面板发版。",
			"kernelTitle": "内核更新",
			"kernelDesc": "向 Release 通道查最新内核。下载仍走完整校验（gzip → 大小 → SHA-256 → 原子落盘），装好后下次启动自动接管。",
			"kernelCheck": "检查更新",
			"kernelInstall": "安装内核",
			"kernelCadence": "自动检查",
			"kernelCadenceHourly": "每小时",
			"kernelCadenceNever": "永不",
			"kernelCurrent": "当前内核",
			"kernelLatest": "通道最新",
			"kernelLastCheck": "上次检查",
			"kernelStateIdle": "已是最新",
			"kernelStateAvailable": "有新版本",
			"kernelStateInstalling": "安装中",
			"kernelStateError": "检查失败",
			"autoRegister": "自动加入新模型",
			"autoRegisterHint": "网关新出现的模型在下一次轮询就会进入 DSH 选择器，思考档位一并带入。",
			"syncTitle": "目录同步",
			"syncAdded": "新增 {0}",
			"syncRemoved": "移除 {0}",
			"syncChanged": "变更 {0}",
			"syncNone": "与上次一致",
			"effortTitle": "思考档位",
			"panelGatewayLine": "网关{0} · {1} 个模型",
			"panelGatewayDown": "网关未运行",
			"usageTitle": "用量",
			"usageMetric": "计量口径",
			"usageTokens": "Token",
			"usageCredits": "积分",
			"usageRange": "时间范围",
			"usageRangeAll": "全部",
			"usageRange30": "30 天",
			"usageRange7": "7 天",
			"usageCalls": "请求数",
			"usageTokensTotal": "Token 总量",
			"usageCreditsTotal": "积分用量",
			"creditsLeftLabel": "剩余积分",
			"creditsLeftCn": "CN 剩余积分",
			"creditsLeftGlobal": "Global 剩余积分",
			"creditsRealmCn": "CN",
			"creditsRealmGlobal": "Global",
			"usageActiveDays": "活跃天数",
			"usagePeakHour": "高峰时段",
			"usageTopModel": "最常用模型",
			"usageHeat": "用量热力图",
			"usageHeatTip": "{0} — {1}",
			"usageEmptyHint": "网关还没有用量记录；发出第一次请求后这里就会出现热力图。",
			"usageFootCredits": "按面板单价折算，累计消耗 {0} 积分。",
			"usageFootTokens": "你的 Token 用量相当于 {0} 本{1}。",
			"usageFootRange": "当前范围没有记录。",
			"usageBook": "《格林童话》",
			"usageTokensUnit": "Token",
			"usageCreditsUnit": "积分",
			"hourMidnight": "凌晨 12 点",
			"hourAm": "上午 {0} 点",
			"hourNoon": "中午 12 点",
			"hourPm": "下午 {0} 点",
			"onlyCheckedAll": "全部",
			"onlyCheckedOnly": "仅已勾选",
			"onlyCheckedHint": "只看已经勾选（对 DSH 可见）的模型。",
			"effortLabel": "思考档位",
			"stateOn": "开",
			"stateOff": "关",
			"colAccount": "账号",
			"colState": "状态",
			"colSuccess": "成功 / 连败",
			"colUsage": "请求 / Token",
			"colLast": "上次成功",
			"realmGlobalShort": "国际版",
			"enterpriseShort": "企业版",
			"creditsUnlimited": "不限",
			"noName": "未命名",
			"credentialExpired": "凭证已过期",
			"credentialExpiry": "凭证 {0} 到期",
			"actionCheckinDone": "已签",
			"creditsLeftHint": "账号池剩余积分（点设置页查看明细）",
			"addAccountTitle": "添加账号",
			"addPickHint": "选一个域，然后扫码完成登录；也可以直接粘贴令牌。",
			"addMode": "登录方式",
			"addModeQr": "扫码登录",
			"addModeToken": "令牌登录",
			"addQrHint": "点开始登录会生成二维码，用手机扫码完成授权。",
			"addTokenPlaceholder": "粘贴账号 JSON 或令牌",
			"addTokenHint": "支持面板 cockpit 导出格式，或 auths/*.json 的 { auth: { accessToken, refreshToken } }。",
			"addTokenSubmit": "导入",
			"addStarting": "正在生成登录链接…",
			"addGlobalHint": "国际版请在浏览器完成登录；本窗口会自动检测结果。",
			"addModeWeb": "浏览器登录"
		};
		/** Fill positional placeholders; an absent argument leaves its slot visible. */
		function fill(template, params) {
			if (params.length === 0) return template;
			return template.replace(/\{(\d+)\}/g, (match, index) => {
				const value = params[Number(index)];
				return value === void 0 ? match : String(value);
			});
		}
		/**
		* Build the translator from the host's bound lookup.
		*
		* `lookup` is called with the key ALONE: the host fills by name, and every
		* template here is positional, so passing parameters through would fill nothing
		* and drop the values. A key the host does not know comes back as the key
		* itself (the host's own fallback), which the page then renders literally —
		* the same degradation every other surface has.
		*/
		function makeTranslator(lookup) {
			return (key, ...params) => {
				let template;
				try {
					template = lookup(key);
				} catch {
					template = key;
				}
				return fill(typeof template === "string" ? template : key, params);
			};
		}
		/** Format a token count the way the settings pages state capacities. */
		function formatTokens(tokens) {
			if (!Number.isFinite(tokens) || tokens <= 0) return "—";
			if (tokens >= 1e6) return String(tokens / 1e6).replace(/\.0$/, "") + "M";
			if (tokens >= 1e3) return String(Math.round(tokens / 1e3)) + "K";
			return String(tokens);
		}
		/** Both dictionaries, keyed by locale id. */
		const COPY = {
			zh: ZH,
			en: {
				"nav": "WorkBuddy2API",
				"title": "WorkBuddy2API Connect",
				"intro": "Manage a local workbuddy2api-panel from here: model list and visibility, reasoning effort, the account pool, and this model route.",
				"versionLine": "Plugin {0}",
				"piAiVersion": "pi-ai {0}",
				"routeOwned": "Route {0}",
				"routeFallback": "Route {0} (fallback)",
				"routeConflict": "{0} is already registered by another plugin; using a fallback route",
				"tabOverview": "Overview",
				"tabModels": "Models",
				"tabAccounts": "Accounts",
				"tabSettings": "Connection",
				"refresh": "Refresh",
				"refreshing": "Refreshing…",
				"lastUpdated": "Updated {0}",
				"neverUpdated": "Never read successfully",
				"connected": "Panel connected",
				"disconnected": "Panel not connected",
				"panelVersion": "Panel v{0}",
				"uptime": "Up {0}",
				"redis": "Redis: {0}",
				"authRequired": "Panel requires an API key",
				"authNotRequired": "Panel has no API key",
				"overviewAccounts": "Accounts",
				"overviewHealthy": "Healthy",
				"overviewCooling": "Cooling",
				"overviewDisabled": "Disabled",
				"overviewPaused": "Paused",
				"overviewModels": "Models",
				"overviewModelsValue": "{0} / {1}",
				"overviewHidden": "{0} hidden",
				"overviewTitle": "Panel overview",
				"overviewDesc": "Figures come from the panel's /panel/api/overview, the same source its own dashboard reads.",
				"quickTitle": "Quick actions",
				"quickDesc": "These act on the panel itself; the page re-reads afterwards.",
				"checkinAll": "Check in all accounts",
				"balanceAll": "Refresh all balances",
				"syncHidden": "Push hidden models",
				"syncHiddenHint": "Write locally hidden models into the panel's models.hidden so the gateway refuses them too.",
				"modelsTitle": "Models",
				"modelsDesc": "The switch controls the DSH picker; with \"push hidden models\" on it also reaches the panel.",
				"regionCn": "Domestic",
				"regionGlobal": "International",
				"regionFilter": "Realm",
				"regionEmpty": "No models in this realm yet; switch tabs or wait for the gateway to refresh.",
				"regionCount": "{0} models",
				"searchPlaceholder": "Search model id or name",
				"enableAll": "Enable all",
				"disableAll": "Disable all",
				"modelEnabled": "Enabled",
				"modelEffort": "Reasoning",
				"modelEffortDefault": "default {0}",
				"modelNoEffort": "No reasoning levels",
				"modelContext": "context {0}",
				"modelOutput": "output {0}",
				"modelVision": "Vision",
				"modelCredits": "rate {0}",
				"modelHiddenBadge": "Hidden",
				"modelsEmpty": "The panel returned no models",
				"modelsEmptyHint": "Check the panel is running with at least one account, then refresh.",
				"accountsTitle": "Account pool",
				"accountsDesc": "Adding uses the panel's own sign-in; disable/pause only affect routing and never delete credentials.",
				"accountCredits": "{0} / {1} credits",
				"accountCreditsOnly": "{0} credits",
				"accountStatusActive": "Healthy",
				"accountStatusCooling": "Cooling",
				"accountStatusDisabled": "Disabled",
				"accountStatusPaused": "Paused",
				"accountRealmCn": "CN",
				"accountRealmGlobal": "Global",
				"accountSuccess": "{0} ok",
				"accountFails": "{0} fails",
				"accountRequests": "{0} requests",
				"accountLastModel": "last {0}",
				"accountExpiry": "token expires {0}",
				"accountRateLimited": "{0} models rate-limited",
				"actionEnable": "Enable",
				"actionDisable": "Disable",
				"actionPause": "Pause",
				"actionResume": "Resume",
				"actionCheckin": "Check in",
				"actionBalance": "Refresh balance",
				"actionRemove": "Remove",
				"actionRemoveConfirm": "Click again to remove",
				"accountsEmpty": "The panel has no accounts yet",
				"addTitle": "Add an account",
				"addDesc": "Start sign-in to get a link, finish it in the browser, then check here.",
				"addRealm": "Realm",
				"addStart": "Start sign-in",
				"addPoll": "Check sign-in",
				"addCancel": "Cancel",
				"addOpen": "Open sign-in page",
				"addWaiting": "Waiting for the browser to finish…",
				"importTitle": "Paste account JSON",
				"importDesc": "Accepts the panel's cockpit export, or an auths/*.json { auth: { accessToken, refreshToken } } document.",
				"importPlaceholder": "Paste one account object or an array…",
				"importButton": "Import",
				"settingsTitle": "Panel connection",
				"settingsDesc": "The plugin reads accounts and models through the panel admin API and serves the model route from the same origin's /v1.",
				"fieldPanelUrl": "Panel URL",
				"fieldPanelUrlHint": "Defaults to http://127.0.0.1:7863; with or without /v1.",
				"fieldApiKey": "API key",
				"fieldApiKeyHint": "The api_key from the panel config.json; never echoed back.",
				"fieldApiKeyPlaceholder": "Empty keeps the current key",
				"fieldRefresh": "Refresh interval (seconds)",
				"fieldRefreshHint": "10–600 seconds; affects only how often this page and the sidebar card read.",
				"fieldSync": "Push hidden models to the panel",
				"fieldSyncHint": "Off keeps the hide local to DSH; the panel still serves the model to other clients.",
				"save": "Save",
				"saving": "Saving…",
				"saved": "Saved",
				"testConnection": "Test connection",
				"testing": "Testing…",
				"testOk": "Connection OK ({0} accounts)",
				"fieldProviderId": "Route id",
				"fieldProviderIdHint": "The provider shown in the picker; workbuddy2api by default.",
				"errorPrefix": "Failed: ",
				"loginUrlLabel": "Sign-in link",
				"copy": "Copy",
				"copied": "Copied",
				"showKey": "Show",
				"hideKey": "Hide",
				"panelCardTitle": "WorkBuddy2API",
				"panelCardAccounts": "{0}/{1} accounts",
				"panelCardModels": "{0}/{1} models",
				"panelCardOffline": "Panel offline",
				"panelTitle": "WorkBuddy2API panel",
				"panelSubtitle": "Models and accounts of the local workbuddy2api-panel",
				"panelClose": "Back to conversation",
				"panelManage": "Open settings",
				"panelRefresh": "Refresh",
				"panelAccountsTitle": "Account pool",
				"panelModelsTitle": "Models",
				"panelNoAccounts": "The panel has no accounts yet",
				"panelNoModels": "No model list yet",
				"panelHidden": "Hidden",
				"poolCredits": "Credits left",
				"creditsOf": "{0} / {1}",
				"creditsLabel": "Credits",
				"creditsTotal": "cap {0}",
				"accountSuccessLabel": "Successes",
				"accountFailsLabel": "Fail streak",
				"accountNoCheckin": "Not checked in",
				"gatewayTitle": "Gateway process",
				"gatewayDesc": "The gateway process is owned by a DSH host composition row; this panel only reads status. The server is downloaded separately.",
				"gatewayStateRunning": "Running",
				"gatewayStateStarting": "Starting",
				"gatewayStateStopped": "Stopped",
				"gatewayStateExternal": "External",
				"gatewayStateFailed": "Failed to start",
				"gatewayStateServerMissing": "Server not installed",
				"gatewayStateServerInvalid": "Server checksum failed",
				"gatewayStateHostUnavailable": "Host subprocess unavailable",
				"gatewayStatePortConflict": "Port in use",
				"gatewayManaged": "Hosted by DSH",
				"gatewayServerVersion": "Server {0}",
				"gatewayStart": "Start",
				"gatewayStop": "Stop",
				"gatewayRestart": "Restart",
				"gatewayLog": "Recent output",
				"gatewayLogEmpty": "No output yet",
				"gatewayRestarts": "Restarted {0} times",
				"gatewayExternalHint": "This gateway was started outside the host row: status and catalog work as usual, and stopping it belongs where it was started.",
				"gatewayBinaryHint": "From the verified server cache; it runs only after its SHA-256 matches.",
				"gatewayBinary": "Executable",
				"gatewayWorkdir": "Working directory",
				"gatewayConfig": "Config file",
				"serverTitle": "Server",
				"serverDesc": "The gateway binary is downloaded separately, never shipped in the panel package. The host row runs it after verification.",
				"serverStateMissing": "Not installed",
				"serverStateReady": "Installed",
				"serverStateDownloading": "Downloading",
				"serverStateVerifying": "Verifying",
				"serverStateInstalling": "Installing",
				"serverStateFailed": "Download failed",
				"serverStateCancelled": "Cancelled",
				"serverStateUnsupported": "No build for this platform",
				"serverDownload": "Download server",
				"serverCancel": "Cancel download",
				"serverRetry": "Retry",
				"serverVerify": "Verify again",
				"serverOpenRelease": "Open download page",
				"serverVersion": "Version",
				"serverPlatform": "Platform",
				"serverDownloadSize": "Download / installed size",
				"serverChecksum": "SHA-256",
				"serverPath": "Installed at",
				"serverProgress": "{0}% · {1} / {2}",
				"serverUpdateAvailable": "Cached {0}; this panel needs {1}",
				"serverErrorNotFound": "The server asset is not published yet (HTTP 404); use the installed cache for local testing, or retry later.",
				"serverErrorChecksum": "The server checksum failed; download it again.",
				"serverManualHint": "Offline install: unzip the .gz into the version directory above, keep the file name workbuddy2api, then press Verify again.",
				"serverPanelUpdateHint": "Panel updates go through the DSH plugin manager; the kernel can be checked and installed on its own under Kernel update, without waiting for a panel release.",
				"kernelTitle": "Kernel update",
				"kernelDesc": "Asks the release channel for the newest kernel. The download keeps every check (gzip → size → SHA-256 → atomic rename) and takes over on the next start.",
				"kernelCheck": "Check now",
				"kernelInstall": "Install kernel",
				"kernelCadence": "Automatic check",
				"kernelCadenceHourly": "Hourly",
				"kernelCadenceNever": "Never",
				"kernelCurrent": "Current kernel",
				"kernelLatest": "Latest on channel",
				"kernelLastCheck": "Last check",
				"kernelStateIdle": "Up to date",
				"kernelStateAvailable": "Update available",
				"kernelStateInstalling": "Installing",
				"kernelStateError": "Check failed",
				"autoRegister": "Adopt new models",
				"autoRegisterHint": "A model the gateway starts answering joins the DSH picker on the next poll, reasoning levels included.",
				"syncTitle": "Catalog sync",
				"syncAdded": "{0} added",
				"syncRemoved": "{0} removed",
				"syncChanged": "{0} changed",
				"syncNone": "Up to date",
				"effortTitle": "Reasoning level",
				"panelGatewayLine": "Gateway {0} · {1} models",
				"panelGatewayDown": "Gateway is not running",
				"usageTitle": "Usage",
				"usageMetric": "Metric",
				"usageTokens": "Tokens",
				"usageCredits": "Credits",
				"usageRange": "Range",
				"usageRangeAll": "All",
				"usageRange30": "30 days",
				"usageRange7": "7 days",
				"usageCalls": "Requests",
				"usageTokensTotal": "Total tokens",
				"usageCreditsTotal": "Credits used",
				"creditsLeftLabel": "Credits left",
				"creditsLeftCn": "CN credits left",
				"creditsLeftGlobal": "Global credits left",
				"creditsRealmCn": "CN",
				"creditsRealmGlobal": "Global",
				"usageActiveDays": "Active days",
				"usagePeakHour": "Peak hour",
				"usageTopModel": "Favorite model",
				"usageHeat": "Usage heat map",
				"usageHeatTip": "{0} — {1}",
				"usageEmptyHint": "No usage recorded yet: the heat map appears after the gateway answers its first request.",
				"usageFootCredits": "At the panel rate, that is {0} credits spent.",
				"usageFootTokens": "That is about {0} copies of {1}.",
				"usageFootRange": "No records in this range.",
				"usageBook": "Grimms' Fairy Tales",
				"usageTokensUnit": "tokens",
				"usageCreditsUnit": "credits",
				"hourMidnight": "12 midnight",
				"hourAm": "{0} am",
				"hourNoon": "12 noon",
				"hourPm": "{0} pm",
				"onlyCheckedAll": "All",
				"onlyCheckedOnly": "Checked only",
				"onlyCheckedHint": "Show only the models ticked for DSH.",
				"effortLabel": "Reasoning",
				"stateOn": "On",
				"stateOff": "Off",
				"colAccount": "Account",
				"colState": "State",
				"colSuccess": "OK / fails",
				"colUsage": "Requests / tokens",
				"colLast": "Last success",
				"realmGlobalShort": "Global",
				"enterpriseShort": "Enterprise",
				"creditsUnlimited": "Unlimited",
				"noName": "Unnamed",
				"credentialExpired": "Credential expired",
				"credentialExpiry": "Credential expires {0}",
				"actionCheckinDone": "Checked in",
				"creditsLeftHint": "Credits left across the pool (see the settings page for the breakdown)",
				"addAccountTitle": "Add account",
				"addPickHint": "Pick a realm, then finish sign-in by scanning the code — or paste a token instead.",
				"addMode": "Sign-in method",
				"addModeQr": "Scan code",
				"addModeToken": "Token",
				"addQrHint": "Start sign-in to mint a QR code, then authorise it from your phone.",
				"addTokenPlaceholder": "Paste the account JSON or a token",
				"addTokenHint": "Accepts the panel's cockpit export, or an auths/*.json { auth: { accessToken, refreshToken } } document.",
				"addTokenSubmit": "Import",
				"addStarting": "Minting a sign-in link…",
				"addGlobalHint": "Finish sign-in in the browser; this window watches for the result.",
				"addModeWeb": "Browser"
			}
		};
		//#endregion
		//#region src/client/ui-rows.tsx
		/** Join class names, dropping the empty ones. */
		function cx(...values) {
			return values.filter((value) => typeof value === "string" && value !== "").join(" ");
		}
		/**
		* One settings row, laid out like the harness's own General page: the title and
		* description on the left, the control on the right, a hairline between rows.
		*/
		function SettingRow({ title, titleFor, tag, description, error, control, className, controlClassName }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: cx("wb2-row", className),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wb2-rowText",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wb2-rowTitleLine",
							children: [titleFor !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: "wb2-rowTitle",
								htmlFor: titleFor,
								children: title
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wb2-rowTitle",
								children: title
							}), tag]
						}),
						error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "wb2-rowError",
							children: error
						}) : null,
						error === void 0 && description !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wb2-rowDesc",
							children: description
						}) : null
					]
				}), control !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: cx("wb2-rowControl", controlClassName),
					children: control
				}) : null]
			});
		}
		/** A heading over a run of rows — the page's one grouping device. */
		function SettingsGroup({ title, action, description, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "wb2-group",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wb2-groupHead",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "wb2-groupTitle",
								children: title
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "wb2-spacer" }),
							action
						]
					}),
					description === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "wb2-groupDesc",
						children: description
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wb2-rows",
						children
					})
				]
			});
		}
		/**
		* A capsule tag, drawn by the platform's own `Tag`.
		*
		* This used to be a local `<span>` with four hand-painted palettes. The
		* platform atom already ships exactly these capsules (`outline`, `neutral`,
		* tinted `success` / `warning` / `danger`), so delegating keeps the pills the
		* same width, weight and tone as the tags elsewhere in the settings surface —
		* and removes a palette that could drift out of the theme on its own.
		*
		* The tone names are this plugin's (`plain`/`muted`/`warn`/`error`/`ok`)
		* because they say what the caller MEANS; the mapping below is the one place
		* that translates them into the platform's vocabulary.
		*/
		function Badge({ tone = "plain", title, children }) {
			const tag = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
				tone: tone === "muted" ? "outline" : tone === "warn" ? "warning" : tone === "error" ? "danger" : tone === "ok" ? "success" : "neutral",
				children
			});
			return title === void 0 ? tag : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				title,
				children: tag
			});
		}
		/** A labelled figure in a filled panel — the dashboard's stat unit. */
		function StatTile({ label, value, sub }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wb2-usageStat",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wb2-usageStatLabel",
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wb2-usageStatValue",
						children: value
					}),
					sub === void 0 || sub === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wb2-usageStatSub",
						children: sub
					})
				]
			});
		}
		/**
		* One account's status dot, drawn by the platform's own `StateDot`.
		*
		* The plugin used to paint its own 8px circle here, which meant a hand-rolled
		* palette that had to be kept in step with the harness by hand. `StateDot` is
		* the atom the rest of the settings surfaces use, so the row's mark is the
		* same mark the session list and the job list draw.
		*
		* The mapping is the platform's vocabulary, not this plugin's: an available
		* account is `done`, a benched one `warning`, a refused one `error`, and a
		* switched-off one `idle`.
		*/
		function StatusDot({ tone, title }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				title,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: tone === "ok" ? "done" : tone === "warn" ? "warning" : tone === "error" ? "error" : "idle" })
			});
		}
		/**
		* The quota ring: one glyph serves the rail button, the footer card's head and
		* the dashboard header. A faint track plus an arc whose sweep is the
		* consumption, drawn from 12 o'clock. Circumference 2πr = 45.55 at r = 7.25.
		*/
		function Ring({ percent, warn, size }) {
			const clamped = Math.min(100, Math.max(0, percent));
			const circumference = 45.55;
			const dashoffset = Math.round(circumference * (1 - clamped / 100) * 1e3) / 1e3;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "wb2-glyph",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 20 20",
					width: size,
					height: size,
					focusable: "false",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "10",
						cy: "10",
						r: "7.25",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.5",
						opacity: "0.4"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "10",
						cy: "10",
						r: "7.25",
						fill: "none",
						stroke: warn ? "var(--dsw-alias-state-error-primary)" : "currentColor",
						strokeWidth: "2.5",
						strokeLinecap: "round",
						strokeDasharray: String(circumference),
						strokeDashoffset: String(dashoffset),
						transform: "rotate(-90 10 10)"
					})]
				})
			});
		}
		/**
		* The platform's segmented control: a translucent track with one raised pill
		* sliding under the picked segment.
		*
		* The indicator's width and offset are computed arithmetically from the count
		* and the index (two custom properties), so it slides without measuring the
		* DOM — the platform's own technique.
		*/
		function SegmentedField({ label, value, options, disabled, onChange, className }) {
			const index = Math.max(0, options.findIndex((option) => option.value === value));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cx("cs-seg", disabled === true && "cs-segDisabled", className),
				role: "radiogroup",
				"aria-label": label,
				style: {
					"--cs-seg-count": String(options.length),
					"--cs-seg-index": String(index)
				},
				children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					role: "radio",
					"aria-checked": value === option.value,
					className: "cs-segItem",
					"data-active": value === option.value ? "true" : "false",
					disabled: disabled === true,
					...option.title === void 0 ? {} : { title: option.title },
					onClick: () => {
						if (value !== option.value) onChange(option.value);
					},
					children: option.label
				}, option.value))
			});
		}
		/** A switch row: the platform Switch's shape, as a labelled control. */
		function ToggleField({ id, checked, disabled, label, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				id,
				className: "wb2-toggle",
				type: "checkbox",
				role: "switch",
				"aria-label": label,
				checked,
				disabled: disabled === true,
				onChange: (event) => {
					onChange(event.target.checked);
				}
			});
		}
		//#endregion
		//#region src/client/ui-button.tsx
		/**
		* The one action button both WorkBuddy surfaces draw.
		*
		* A thin wrapper over the platform's `Button` (a PLATFORM SEED module the shell
		* provides), so a row's controls are literally the platform's controls rather
		* than a local reimplementation with its own colours and metrics. The wrapper
		* exists to pin the two choices this plugin always makes — compact size, and a
		* destructive member of the family for anything that deletes a stored sign-in.
		*
		* @module dsh-workbuddy-connect/client/ui-button
		*/
		/** Render one action button. */
		function ActionButton({ label, tone, disabled, title, onClick }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: tone === "primary" ? "primary" : "ghost",
				size: "sm",
				disabled: disabled === true,
				...title === void 0 ? {} : { title },
				...tone === "danger" ? { className: "wb2-dangerButton" } : {},
				onClick,
				children: label
			});
		}
		//#endregion
		//#region src/client/panel-view.tsx
		/**
		* The dashboard: a sidebar footer card that summarises the gateway, and the
		* centre-column panel it selects.
		*
		* Both read the shared store, so the card's lines are the same facts the panel's
		* lists carry. The card is the gateway's status light as much as its launcher: a
		* stopped process, an external one, and a running one are three different states
		* and the card says which, because "no accounts" and "no process" are different
		* problems with different fixes.
		*
		* @module dsh-workbuddy2api-gateway/client/panel-view
		*/
		/** The gateway's state as words. */
		function gatewayStateText(state, t) {
			if (state === "running") return t("gatewayStateRunning");
			if (state === "starting") return t("gatewayStateStarting");
			if (state === "external") return t("gatewayStateExternal");
			if (state === "failed") return t("gatewayStateFailed");
			if (state === "server-missing") return t("gatewayStateServerMissing");
			if (state === "server-invalid") return t("gatewayStateServerInvalid");
			if (state === "host-unavailable") return t("gatewayStateHostUnavailable");
			if (state === "port-conflict") return t("gatewayStatePortConflict");
			return t("gatewayStateStopped");
		}
		/** The gateway's state as a tone. */
		function gatewayTone(state) {
			if (state === "running") return "ok";
			if (state === "starting" || state === "external" || state === "server-missing" || state === "server-invalid") return "warn";
			if (state === "failed" || state === "host-unavailable" || state === "port-conflict") return "error";
			return "off";
		}
		/** Share of the pool that can serve a request right now. */
		function ringPercent(document) {
			const total = document.counts.total;
			if (total === 0) return 0;
			return (total - document.counts.cooling - document.counts.disabled - document.counts.paused) / total * 100;
		}
		/** One account's status as words. */
		function accountStateText$1(account, t) {
			if (account.status === "active") return t("accountStatusActive");
			if (account.status === "cooling") return t("accountStatusCooling");
			if (account.status === "disabled") return t("accountStatusDisabled");
			return t("accountStatusPaused");
		}
		/** One account's status as a tone. */
		function accountTone$1(account) {
			if (account.status === "active") return "ok";
			if (account.status === "cooling") return "warn";
			if (account.status === "disabled") return "error";
			return "off";
		}
		/** Group a count into the compact form the tiles use. */
		function figure(value) {
			if (value === void 0 || !Number.isFinite(value)) return "—";
			return new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(value);
		}
		/** Read the store, starting and stopping the shared poll with the mount. */
		function useDocument(store) {
			const snapshot = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
			(0, react.useEffect)(() => {
				store.start();
				return () => {
					store.stop();
				};
			}, [store]);
			return snapshot;
		}
		/** One account on the dashboard: identity, state, and its figures. */
		function AccountCard({ account, t, footer }) {
			const tone = accountTone$1(account);
			const name = account.nickname === "" ? account.uid : account.nickname;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "wb2-card",
				"aria-label": name,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wb2-cardHead",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wb2-avatar",
								"aria-hidden": "true",
								children: name.slice(0, 1).toUpperCase()
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wb2-cardIdentity",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wb2-cardTitle",
									children: name
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "wb2-spacer" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, {
								tone,
								title: accountStateText$1(account, t)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: tone === "ok" ? "ok" : tone === "error" ? "error" : tone === "warn" ? "warn" : "muted",
								children: accountStateText$1(account, t)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "muted",
								children: account.realm === "global" ? t("accountRealmGlobal") : t("accountRealmCn")
							}),
							account.checkinDone ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "warn",
								children: t("accountNoCheckin")
							}),
							account.rateLimitedModels === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "warn",
								children: t("accountRateLimited", account.rateLimitedModels)
							})
						]
					}),
					account.disabledReason === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "wb2-noticeHint",
						children: account.disabledReason
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wb2-tiles",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatTile, {
								label: t("creditsLabel"),
								value: account.credits === void 0 ? "—" : figure(account.credits),
								sub: account.creditsTotal === void 0 ? void 0 : t("creditsTotal", figure(account.creditsTotal))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatTile, {
								label: t("accountSuccessLabel"),
								value: String(account.successCount)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatTile, {
								label: t("accountFailsLabel"),
								value: String(account.failStreak)
							})
						]
					}),
					footer
				]
			});
		}
		/** One model row on the dashboard. */
		function ModelLine({ model, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
				className: model.enabled ? void 0 : "wb2-rowDimmed",
				title: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					model.name,
					model.supportsImages ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
						tone: "muted",
						children: t("modelVision")
					}) : null,
					model.enabled ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
						tone: "warn",
						children: t("panelHidden")
					})
				] }),
				description: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "wb2-mono",
						children: model.id
					}),
					" · ",
					t("modelContext", model.contextLength),
					" · ",
					t("modelOutput", model.maxOutputTokens)
				] }),
				control: model.defaultEffort === void 0 ? void 0 : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
					tone: "muted",
					children: model.defaultEffort
				})
			});
		}
		/**
		* The centre-column dashboard.
		*
		* It covers the Conversation while open, so it carries its own way back — and,
		* because the process is the plugin's own, the three controls that matter here
		* (start, restart, stop) sit in its header rather than one page away.
		*/
		function WorkBuddy2ApiPanel(props) {
			const { t, store, close } = props;
			const snapshot = useDocument(store);
			const document = snapshot.document;
			const gateway = document?.gateway;
			const percent = document === void 0 ? 0 : ringPercent(document);
			const tone = gateway === void 0 ? "off" : gatewayTone(gateway.state);
			const busy = snapshot.pending !== void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wb2-main",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wb2-mainInner",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "wb2-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
								percent,
								warn: tone === "error" || tone === "warn",
								size: 20
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "wb2-headerText",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									className: "wb2-titleLg",
									children: t("panelTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "wb2-subtitle",
									children: t("panelSubtitle")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "wb2-spacer" }),
							gateway === void 0 || gateway.state === "running" || gateway.state === "external" || document?.server.installed !== true || gateway.state === "host-unavailable" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: t("gatewayStart"),
								tone: "primary",
								disabled: busy,
								onClick: () => {
									store.act({ action: "gateway-start" }, "gateway-start");
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: t("gatewayRestart"),
								disabled: busy || document?.server.installed !== true,
								onClick: () => {
									store.act({ action: "gateway-restart" }, "gateway-restart");
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: t("panelRefresh"),
								disabled: busy,
								onClick: () => {
									store.act({ action: "refresh" });
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: t("panelClose"),
								onClick: close
							})
						]
					}), document === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "wb2-hint",
						children: snapshot.error === void 0 ? t("refreshing") : t("errorPrefix") + snapshot.error
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						snapshot.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wb2-notice wb2-noticeError",
							role: "status",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "wb2-noticeTitle",
								children: t("errorPrefix")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "wb2-noticeHint",
								children: snapshot.error
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
							title: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, {
									tone,
									title: gatewayStateText(document.gateway.state, t)
								}),
								t("gatewayTitle"),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
									tone: tone === "ok" ? "ok" : tone === "error" ? "error" : tone === "warn" ? "warn" : "muted",
									children: gatewayStateText(document.gateway.state, t)
								}),
								document.gateway.serverVersion === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
									tone: "muted",
									children: t("gatewayServerVersion", document.gateway.serverVersion)
								})
							] }),
							description: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [document.gateway.binary === void 0 ? t("gatewayBinary") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wb2-mono",
								children: document.gateway.binary
							}), document.gateway.restarts === 0 ? null : " · " + t("gatewayRestarts", document.gateway.restarts)] }),
							control: document.gateway.managed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: t("gatewayStop"),
								tone: "danger",
								disabled: busy,
								onClick: () => {
									store.act({ action: "gateway-stop" }, "gateway-stop");
								}
							}) : void 0
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wb2-tiles",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatTile, {
									label: t("overviewAccounts"),
									value: String(document.counts.total)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatTile, {
									label: t("overviewHealthy"),
									value: String(document.counts.healthy)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatTile, {
									label: t("overviewModels"),
									value: t("overviewModelsValue", document.counts.enabledModels, document.counts.models)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatTile, {
									label: t("syncTitle"),
									value: document.sync.added.length === 0 && document.sync.changed.length === 0 ? t("syncNone") : t("syncAdded", document.sync.added.length)
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "wb2-groupTitle",
							children: t("panelAccountsTitle")
						}),
						document.accounts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "wb2-hint",
							children: t("panelNoAccounts")
						}) : document.accounts.map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountCard, {
							account,
							t
						}, account.uid)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "wb2-groupTitle",
							children: t("panelModelsTitle")
						}),
						document.models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "wb2-hint",
							children: t("panelNoModels")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wb2-rows",
							children: document.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelLine, {
								model,
								t
							}, model.id))
						})
					] })]
				})
			});
		}
		//#endregion
		//#region src/client/usage-card.tsx
		/**
		* The overview's head: one usage card in the Claude Style idiom.
		*
		* The layout is the widget this plugin's owner asked for, transplanted onto this
		* plugin's own numbers: six figures over a twelve-week heat map and one closing
		* sentence. Two additions are ours, because this plugin watches a metered
		* gateway rather than a chat client:
		*
		* 1. **Left credits** sits beside the usage figures — the pool's spendable
		*    balance is the number a user of this plugin actually plans around.
		* 2. **Tokens or credits** is a switch over the SAME history: the gateway's
		*    ledger records both per bucket, so flipping the metric redraws the figures,
		*    the heat map intensity and the closing sentence without a second read.
		*
		* A missing ledger is not an error state: the card renders zeroed, and the
		* sentence says so plainly instead of inventing a comparison.
		*
		* @module dsh-workbuddy2api-gateway/client/usage-card
		*/
		/** A quiet segmented control in the Claude idiom: a track, a lift, no chrome. */
		function Seg({ label, value, options, onChange }) {
			const active = Math.max(0, options.findIndex((option) => option.value === value));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "cs-seg",
				role: "radiogroup",
				"aria-label": label,
				style: {
					"--cs-seg-count": String(options.length),
					"--cs-seg-index": String(active)
				},
				children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					role: "radio",
					"aria-checked": option.value === value,
					className: "cs-segItem",
					"data-active": option.value === value ? "true" : "false",
					onClick: () => {
						onChange(option.value);
					},
					children: option.label
				}, option.value))
			});
		}
		/** Weeks the widget draws: 53 columns, matching the widget it mirrors. */
		const WINDOW_DAYS = 210;
		/** Short token figure: 1.9B, 84.2M, 12.3K. */
		function compactTokens(value) {
			if (!Number.isFinite(value) || value <= 0) return "0";
			if (value >= 1e9) return (value / 1e9).toFixed(1) + "B";
			if (value >= 1e6) return (value / 1e6).toFixed(1) + "M";
			if (value >= 1e3) return (value / 1e3).toFixed(1) + "K";
			return String(Math.round(value));
		}
		/** Group a count with separators. */
		function grouped$1(value) {
			return new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 }).format(value);
		}
		/** "下午 10 点" from an hour number. */
		function hourLabel(hour, t) {
			if (hour === void 0) return "—";
			if (hour === 0) return t("hourMidnight");
			if (hour < 6) return t("hourAm", String(hour));
			if (hour < 12) return t("hourAm", String(hour));
			if (hour === 12) return t("hourNoon");
			if (hour < 18) return t("hourPm", String(hour - 12));
			return t("hourPm", String(hour - 12));
		}
		/** One figure in the grid. */
		function Stat({ label, value, small }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "cs-stat",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "cs-statLabel",
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: small === true ? "cs-statValue cs-statValueSmall" : "cs-statValue",
					title: value,
					children: value
				})]
			});
		}
		/** One heat cell's intensity bucket (0 = nothing). */
		function level(value, peak) {
			if (value <= 0 || peak <= 0) return 0;
			const ratio = value / peak;
			if (ratio > .75) return 4;
			if (ratio > .5) return 3;
			if (ratio > .25) return 2;
			return 1;
		}
		/** Slice the window to the chosen range. */
		function window$1(days, range) {
			if (range === "7") return days.slice(-7);
			if (range === "30") return days.slice(-30);
			return days;
		}
		/** The card. */
		function UsageCard({ t, usage, creditsLeft }) {
			const [metric, setMetric] = (0, react.useState)("tokens");
			const [range, setRange] = (0, react.useState)("all");
			const padded = (0, react.useMemo)(() => {
				const missing = WINDOW_DAYS - usage.days.length;
				if (missing <= 0) return usage.days;
				const quiet = [];
				for (let index = missing; index > 0; index -= 1) quiet.push({
					date: "quiet-" + String(index),
					calls: 0,
					tokens: 0,
					credits: 0
				});
				return [...quiet, ...usage.days];
			}, [usage.days]);
			const view = (0, react.useMemo)(() => window$1(padded, range), [padded, range]);
			const heat = padded;
			const totals = (0, react.useMemo)(() => {
				let calls = 0;
				let tokens = 0;
				let credits = 0;
				for (const day of view) {
					calls += day.calls;
					tokens += day.tokens;
					credits += day.credits;
				}
				return {
					calls,
					tokens,
					credits,
					activeDays: view.filter((day) => day.calls > 0).length
				};
			}, [view]);
			const plotted = metric === "tokens" ? totals.tokens : totals.credits;
			const peak = (0, react.useMemo)(() => heat.reduce((max, day) => Math.max(max, metric === "tokens" ? day.tokens : day.credits), 0), [heat, metric]);
			const cells = (0, react.useMemo)(() => {
				const lead = [];
				const missing = (7 - heat.length % 7) % 7;
				for (let index = 0; index < missing; index += 1) lead.push({
					date: "pad-" + String(index),
					calls: 0,
					tokens: 0,
					credits: 0
				});
				return [...lead, ...heat];
			}, [heat]);
			const book = metric === "tokens" && totals.tokens > 0 ? {
				copies: Math.max(1, Math.round(totals.tokens / 132467)),
				name: t("usageBook")
			} : void 0;
			const creditParts = [];
			if (creditsLeft?.cn !== void 0) creditParts.push(t("creditsRealmCn") + " " + grouped$1(Math.round(creditsLeft.cn)));
			if (creditsLeft?.global !== void 0) creditParts.push(t("creditsRealmGlobal") + " " + grouped$1(Math.round(creditsLeft.global)));
			const creditText = creditParts.length === 0 ? "—" : creditParts.join(" · ");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "cs-usage",
				"aria-label": t("usageTitle"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "cs-usageHead",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "cs-usageTitle",
								children: t("usageTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "cs-spacer" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Seg, {
								label: t("usageMetric"),
								value: metric,
								onChange: (value) => {
									setMetric(value);
								},
								options: [{
									value: "tokens",
									label: t("usageTokens")
								}, {
									value: "credits",
									label: t("usageCredits")
								}]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Seg, {
								label: t("usageRange"),
								value: range,
								onChange: (value) => {
									setRange(value);
								},
								options: [
									{
										value: "all",
										label: t("usageRangeAll")
									},
									{
										value: "30",
										label: t("usageRange30")
									},
									{
										value: "7",
										label: t("usageRange7")
									}
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "cs-usageGrid",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
								label: t("usageCalls"),
								value: grouped$1(totals.calls)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
								label: metric === "tokens" ? t("usageTokensTotal") : t("usageCreditsTotal"),
								value: metric === "tokens" ? compactTokens(totals.tokens) : grouped$1(Math.round(totals.credits))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
								small: true,
								label: t("creditsLeftLabel"),
								value: creditText
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
								label: t("usageActiveDays"),
								value: String(totals.activeDays)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
								label: t("usagePeakHour"),
								value: hourLabel(usage.peakHour, t)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stat, {
								label: t("usageTopModel"),
								value: usage.topModel ?? "—"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "cs-heat",
						role: "img",
						"aria-label": t("usageHeat"),
						children: cells.map((day) => {
							const value = metric === "tokens" ? day.tokens : day.credits;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "cs-heatCell",
								"data-level": level(value, peak),
								title: t("usageHeatTip", day.date, metric === "tokens" ? compactTokens(day.tokens) + " " + t("usageTokensUnit") : grouped$1(Math.round(day.credits)) + " " + t("usageCreditsUnit"))
							}, day.date);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "cs-usageFoot",
						children: [usage.empty ? t("usageEmptyHint") : book === void 0 ? t("usageFootCredits", grouped$1(Math.round(totals.credits))) : t("usageFootTokens", grouped$1(book.copies), book.name), plotted === 0 && !usage.empty ? " " + t("usageFootRange", grouped$1(0)) : null]
					})
				]
			});
		}
		//#endregion
		//#region src/client/qr-code.ts
		/** Mode indicator for 8-bit byte mode. */
		const MODE_BYTE = 4;
		/**
		* Data capacity, in bytes, for levels M by version (1-20), byte mode.
		*
		* From the Model 2 capacity tables: total codewords minus the error-correction
		* codewords for that version, minus the mode/length header, rounded down. Held
		* as a table because the block structures below are also tabulated and driving
		* one from the other invites an off-by-one that only shows up at one version.
		*/
		const BYTE_CAPACITY_M = [
			14,
			26,
			42,
			62,
			84,
			106,
			122,
			152,
			180,
			213,
			251,
			287,
			331,
			362,
			412,
			450,
			504,
			560,
			624,
			666
		];
		const BLOCKS_M = [
			{
				ecPerBlock: 10,
				groups: [[1, 16]]
			},
			{
				ecPerBlock: 16,
				groups: [[1, 28]]
			},
			{
				ecPerBlock: 26,
				groups: [[1, 44]]
			},
			{
				ecPerBlock: 18,
				groups: [[2, 32]]
			},
			{
				ecPerBlock: 24,
				groups: [[2, 43]]
			},
			{
				ecPerBlock: 16,
				groups: [[4, 27]]
			},
			{
				ecPerBlock: 18,
				groups: [[4, 31]]
			},
			{
				ecPerBlock: 22,
				groups: [[2, 38], [2, 39]]
			},
			{
				ecPerBlock: 22,
				groups: [[3, 36], [2, 37]]
			},
			{
				ecPerBlock: 26,
				groups: [[4, 43], [1, 44]]
			},
			{
				ecPerBlock: 30,
				groups: [[1, 50], [4, 51]]
			},
			{
				ecPerBlock: 22,
				groups: [[6, 36], [2, 37]]
			},
			{
				ecPerBlock: 22,
				groups: [[8, 37], [1, 38]]
			},
			{
				ecPerBlock: 24,
				groups: [[4, 40], [5, 41]]
			},
			{
				ecPerBlock: 24,
				groups: [[5, 41], [5, 42]]
			},
			{
				ecPerBlock: 28,
				groups: [[7, 45], [3, 46]]
			},
			{
				ecPerBlock: 28,
				groups: [[10, 46], [1, 47]]
			},
			{
				ecPerBlock: 26,
				groups: [[9, 43], [4, 44]]
			},
			{
				ecPerBlock: 26,
				groups: [[3, 44], [11, 45]]
			},
			{
				ecPerBlock: 26,
				groups: [[3, 41], [13, 42]]
			}
		];
		/**
		* Alignment pattern centre coordinates per version.
		*
		* The spec's own table; the arithmetic rule that generates it has exceptions at
		* the low versions and the table is shorter to read than the rule.
		*/
		const ALIGNMENT_CENTRES = [
			[],
			[6, 18],
			[6, 22],
			[6, 26],
			[6, 30],
			[6, 34],
			[
				6,
				22,
				38
			],
			[
				6,
				24,
				42
			],
			[
				6,
				26,
				46
			],
			[
				6,
				28,
				50
			],
			[
				6,
				30,
				54
			],
			[
				6,
				32,
				58
			],
			[
				6,
				34,
				62
			],
			[
				6,
				26,
				46,
				66
			],
			[
				6,
				26,
				48,
				70
			],
			[
				6,
				26,
				50,
				74
			],
			[
				6,
				30,
				54,
				78
			],
			[
				6,
				30,
				56,
				82
			],
			[
				6,
				30,
				58,
				86
			],
			[
				6,
				34,
				62,
				90
			]
		];
		/** One dark module, plus the quiet zone the spec requires around the symbol. */
		function isDarkQrModule(code, x, y) {
			if (x < 0 || y < 0 || x >= code.size || y >= code.size) return false;
			return code.modules[y * code.size + x] === true;
		}
		function encodeQrCode(text, options = {}) {
			const bytes = new TextEncoder().encode(text);
			const version = smallestVersion(bytes.length);
			if (version === void 0) throw new Error(`QR payload of ${String(bytes.length)} bytes exceeds the supported capacity`);
			const size = version * 4 + 17;
			return {
				size,
				modules: placeCodewords(buildCodewords(bytes, version), version, size, options.mask)
			};
		}
		/** The lowest version whose level-M byte capacity fits, or undefined. */
		function smallestVersion(byteLength) {
			for (let index = 0; index < BYTE_CAPACITY_M.length; index += 1) if (byteLength <= BYTE_CAPACITY_M[index]) return index + 1;
		}
		/**
		* The final codeword sequence: mode + length + data + terminator + padding,
		* split into blocks, each block extended with its own Reed–Solomon codewords,
		* then interleaved in the spec's order.
		*/
		function buildCodewords(bytes, version) {
			const layout = BLOCKS_M[version - 1];
			const totalData = layout.groups.reduce((sum, [count, per]) => sum + count * per, 0);
			const bits = [];
			pushBits(bits, MODE_BYTE, 4);
			pushBits(bits, bytes.length, version < 10 ? 8 : 16);
			for (const byte of bytes) pushBits(bits, byte, 8);
			const capacityBits = totalData * 8;
			pushBits(bits, 0, Math.min(4, capacityBits - bits.length));
			pushBits(bits, 0, (8 - bits.length % 8) % 8);
			const data = [];
			for (let index = 0; index < bits.length; index += 8) {
				let value = 0;
				for (let offset = 0; offset < 8; offset += 1) value = value << 1 | (bits[index + offset] ?? 0);
				data.push(value);
			}
			const PAD = [236, 17];
			for (let index = 0; data.length < totalData; index += 1) data.push(PAD[index % 2]);
			const blocks = [];
			let cursor = 0;
			for (const [count, per] of layout.groups) for (let block = 0; block < count; block += 1) {
				blocks.push(data.slice(cursor, cursor + per));
				cursor += per;
			}
			const ecBlocks = blocks.map((block) => reedSolomon(block, layout.ecPerBlock));
			const out = [];
			const maxData = Math.max(...blocks.map((block) => block.length));
			for (let index = 0; index < maxData; index += 1) for (const block of blocks) {
				const value = block[index];
				if (value !== void 0) out.push(value);
			}
			for (let index = 0; index < layout.ecPerBlock; index += 1) for (const block of ecBlocks) {
				const value = block[index];
				if (value !== void 0) out.push(value);
			}
			return out;
		}
		/** Append the low `count` bits of `value`, most significant first. */
		function pushBits(bits, value, count) {
			for (let shift = count - 1; shift >= 0; shift -= 1) bits.push(value >> shift & 1);
		}
		/**
		* Reed–Solomon codewords over GF(256) with the QR primitive polynomial 0x11d.
		*
		* The remainder of the message times `x^ecLength` divided by the generator
		* polynomial, computed with the shift register the spec describes.
		*/
		function reedSolomon(data, ecLength) {
			const generator = generatorPolynomial(ecLength).slice(1);
			const remainder = new Array(ecLength).fill(0);
			for (const byte of data) {
				const factor = byte ^ remainder[0];
				remainder.shift();
				remainder.push(0);
				for (let index = 0; index < ecLength; index += 1) remainder[index] = remainder[index] ^ gfMultiply(factor, generator[index]);
			}
			return remainder;
		}
		/**
		* The degree-`ecLength` generator polynomial, as coefficients with the leading
		* 1 dropped: `(x - a^0)(x - a^1)...(x - a^(ecLength-1))`.
		*/
		function generatorPolynomial(ecLength) {
			let polynomial = [1];
			for (let index = 0; index < ecLength; index += 1) {
				const next = new Array(polynomial.length + 1).fill(0);
				for (let term = 0; term < polynomial.length; term += 1) {
					next[term] = next[term] ^ polynomial[term];
					next[term + 1] = next[term + 1] ^ gfMultiply(polynomial[term], gfPower(index));
				}
				polynomial = next;
			}
			return polynomial;
		}
		/** Multiply two GF(256) elements modulo the QR primitive polynomial. */
		function gfMultiply(left, right) {
			let result = 0;
			let a = left;
			let b = right;
			while (b > 0) {
				if ((b & 1) === 1) result ^= a;
				a <<= 1;
				if (a > 255) a ^= 285;
				b >>= 1;
			}
			return result;
		}
		/** `2` raised to the `power`-th in GF(256), used to build the generator. */
		function gfPower(power) {
			let value = 1;
			for (let index = 0; index < power; index += 1) value = gfMultiply(value, 2);
			return value;
		}
		function placeCodewords(codewords, version, size, forced) {
			if (forced !== void 0) {
				const matrix = new Matrix(size);
				drawFunctionPatterns(matrix, version);
				drawCodewords(matrix, codewords);
				applyMask(matrix, forced);
				drawFormatBits(matrix, forced);
				return matrix.modules.slice();
			}
			const matrix = new Matrix(size);
			drawFunctionPatterns(matrix, version);
			drawCodewords(matrix, codewords);
			let best;
			let bestScore = Number.POSITIVE_INFINITY;
			for (let mask = 0; mask < 8; mask += 1) {
				const candidate = new Matrix(size);
				drawFunctionPatterns(candidate, version);
				drawCodewords(candidate, codewords);
				applyMask(candidate, mask);
				drawFormatBits(candidate, mask);
				const score = penalty(candidate);
				if (score < bestScore) {
					bestScore = score;
					best = candidate.modules.slice();
				}
			}
			if (best === void 0) throw new Error("QR mask selection produced no candidate");
			return best;
		}
		/** A square of modules with typed access, so the builder reads as coordinates. */
		var Matrix = class {
			size;
			modules;
			/** Which modules are function patterns and must not be masked or overwritten. */
			reserved;
			constructor(size) {
				this.size = size;
				this.modules = new Array(size * size).fill(false);
				this.reserved = new Array(size * size).fill(false);
			}
			get(x, y) {
				return this.modules[y * this.size + x] === true;
			}
			set(x, y, dark) {
				if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
				this.modules[y * this.size + x] = dark;
			}
			mark(x, y) {
				if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
				this.reserved[y * this.size + x] = true;
			}
		};
		/** Finder patterns, separators, timing, alignment, and the dark module. */
		function drawFunctionPatterns(matrix, version) {
			const size = matrix.size;
			for (const [originX, originY] of [
				[0, 0],
				[size - 7, 0],
				[0, size - 7]
			]) for (let y = -1; y <= 7; y += 1) for (let x = -1; x <= 7; x += 1) {
				const px = originX + x;
				const py = originY + y;
				const inside = x >= 0 && x <= 6 && y >= 0 && y <= 6;
				const edge = inside && (x === 0 || x === 6 || y === 0 || y === 6);
				const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
				matrix.set(px, py, inside && (edge || core));
				matrix.mark(px, py);
			}
			for (let index = 8; index < size - 8; index += 1) {
				const dark = index % 2 === 0;
				matrix.set(index, 6, dark);
				matrix.mark(index, 6);
				matrix.set(6, index, dark);
				matrix.mark(6, index);
			}
			const centres = ALIGNMENT_CENTRES[version - 1];
			for (const centreY of centres) for (const centreX of centres) {
				if (centreX === 6 && centreY === 6 || centreX === 6 && centreY === size - 7 || centreX === size - 7 && centreY === 6) continue;
				for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) {
					const dark = Math.max(Math.abs(x), Math.abs(y)) !== 1;
					matrix.set(centreX + x, centreY + y, dark);
					matrix.mark(centreX + x, centreY + y);
				}
			}
			reserveFormatAreas(matrix, version);
			matrix.set(8, size - 8, true);
			matrix.mark(8, size - 8);
		}
		/** Mark the format/version modules as reserved so data never lands on them. */
		function reserveFormatAreas(matrix, version) {
			const size = matrix.size;
			for (let index = 0; index < 9; index += 1) {
				matrix.mark(index, 8);
				matrix.mark(8, index);
			}
			for (let index = 0; index < 8; index += 1) {
				matrix.mark(size - 1 - index, 8);
				matrix.mark(8, size - 1 - index);
			}
			if (version >= 7) for (let y = 0; y < 6; y += 1) for (let x = size - 11; x < size - 8; x += 1) {
				matrix.mark(x, y);
				matrix.mark(y, x);
			}
		}
		/**
		* Walk the symbol in the spec's zigzag — right to left in two-column pairs,
		* alternating upward and downward — placing the codeword bits.
		*/
		function drawCodewords(matrix, codewords) {
			const size = matrix.size;
			let bitIndex = 0;
			let upward = true;
			for (let right = size - 1; right >= 1; right -= 2) {
				if (right === 6) right = 5;
				for (let step = 0; step < size; step += 1) {
					const y = upward ? size - 1 - step : step;
					for (const x of [right, right - 1]) {
						if (matrix.reserved[y * size + x] === true) continue;
						const byte = codewords[bitIndex >> 3];
						const dark = byte === void 0 ? false : (byte >> 7 - (bitIndex & 7) & 1) === 1;
						matrix.set(x, y, dark);
						bitIndex += 1;
					}
				}
				upward = !upward;
			}
		}
		/** XOR the mask pattern over every non-function module. */
		function applyMask(matrix, mask) {
			const size = matrix.size;
			for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
				if (matrix.reserved[y * size + x] === true) continue;
				if (!maskApplies(mask, x, y)) continue;
				matrix.modules[y * size + x] = !matrix.get(x, y);
			}
		}
		/** The eight mask conditions of the spec, by index. */
		function maskApplies(mask, x, y) {
			switch (mask) {
				case 0: return (x + y) % 2 === 0;
				case 1: return y % 2 === 0;
				case 2: return x % 3 === 0;
				case 3: return (x + y) % 3 === 0;
				case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
				case 5: return x * y % 2 + x * y % 3 === 0;
				case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
				case 7: return ((x + y) % 2 + x * y % 3) % 2 === 0;
				default: return false;
			}
		}
		/** Write the format information for `mask` (and the version blocks, if any). */
		function drawFormatBits(matrix, mask) {
			const size = matrix.size;
			const data = 0 | mask;
			let shifted = data << 10;
			for (let index = 14; index >= 10; index -= 1) if ((shifted >> index & 1) === 1) shifted ^= 1335 << index - 10;
			const bits = (data << 10 | shifted) ^ 21522;
			const bit = (index) => (bits >> index & 1) === 1;
			for (let index = 0; index <= 5; index += 1) matrix.set(8, index, bit(index));
			matrix.set(8, 7, bit(6));
			matrix.set(8, 8, bit(7));
			matrix.set(7, 8, bit(8));
			for (let index = 9; index <= 14; index += 1) matrix.set(14 - index, 8, bit(index));
			for (let index = 0; index <= 7; index += 1) matrix.set(size - 1 - index, 8, bit(index));
			for (let index = 8; index <= 14; index += 1) matrix.set(8, size - 15 + index, bit(index));
			matrix.set(8, size - 8, true);
			const version = (size - 17) / 4;
			if (version < 7) return;
			let versionRemainder = version;
			for (let index = 0; index < 12; index += 1) versionRemainder = versionRemainder << 1 ^ (versionRemainder >> 11 & 1) * 7973;
			const versionBits = version << 12 | versionRemainder;
			for (let index = 0; index < 18; index += 1) {
				const dark = (versionBits >> index & 1) === 1;
				const a = Math.floor(index / 3);
				const b = index % 3;
				matrix.set(size - 11 + b, a, dark);
				matrix.set(a, size - 11 + b, dark);
			}
		}
		/** The spec's four penalty rules, summed. Lower is a better mask. */
		function penalty(matrix) {
			const size = matrix.size;
			let score = 0;
			for (let y = 0; y < size; y += 1) {
				let runColour = matrix.get(0, y);
				let runLength = 1;
				for (let x = 1; x < size; x += 1) {
					const colour = matrix.get(x, y);
					if (colour === runColour) runLength += 1;
					else {
						if (runLength >= 5) score += runLength - 2;
						runColour = colour;
						runLength = 1;
					}
				}
				if (runLength >= 5) score += runLength - 2;
			}
			for (let x = 0; x < size; x += 1) {
				let runColour = matrix.get(x, 0);
				let runLength = 1;
				for (let y = 1; y < size; y += 1) {
					const colour = matrix.get(x, y);
					if (colour === runColour) runLength += 1;
					else {
						if (runLength >= 5) score += runLength - 2;
						runColour = colour;
						runLength = 1;
					}
				}
				if (runLength >= 5) score += runLength - 2;
			}
			for (let y = 0; y < size - 1; y += 1) for (let x = 0; x < size - 1; x += 1) {
				const colour = matrix.get(x, y);
				if (colour === matrix.get(x + 1, y) && colour === matrix.get(x, y + 1) && colour === matrix.get(x + 1, y + 1)) score += 3;
			}
			const DARK_LIGHT_RUN = 1488;
			const LIGHT_DARK_RUN = 93;
			for (let y = 0; y < size; y += 1) {
				let across = 0;
				let down = 0;
				for (let index = 0; index < size; index += 1) {
					across = across << 1 & 2047 | (matrix.get(index, y) ? 1 : 0);
					if (index >= 10 && (across === DARK_LIGHT_RUN || across === LIGHT_DARK_RUN)) score += 40;
					down = down << 1 & 2047 | (matrix.get(y, index) ? 1 : 0);
					if (index >= 10 && (down === DARK_LIGHT_RUN || down === LIGHT_DARK_RUN)) score += 40;
				}
			}
			let dark = 0;
			for (const module of matrix.modules) if (module) dark += 1;
			const steps = Math.abs(Math.ceil(dark * 100 / (size * size) / 5) - 10);
			score += steps * 10;
			return score;
		}
		//#endregion
		//#region src/client/qr-view.tsx
		/**
		* The dialog's QR symbol: a matrix from `encodeQrCode` painted as one path.
		*
		* One `<path>` instead of `size*size` rectangles: a version-10 symbol is ~57x57,
		* and a few thousand DOM nodes for one dialog is a cost the browser pays on every
		* keystroke elsewhere on the page. Adjacent modules merge into horizontal runs
		* because SVG fills are expensive per subpath, not per glyph.
		*
		* The frame is white and square whatever the theme: a scanner needs contrast, and
		* a QR drawn in the page's dark palette does not scan.
		*
		* @module dsh-workbuddy2api-gateway/client/qr-view
		*/
		/** The quiet zone the spec asks for, in modules. */
		const QUIET = 4;
		/** Render one QR symbol, or nothing when the payload cannot be encoded. */
		function QrView({ value, size = 176 }) {
			const code = (0, react.useMemo)(() => {
				try {
					return encodeQrCode(value);
				} catch {
					return;
				}
			}, [value]);
			const path = (0, react.useMemo)(() => {
				if (code === void 0) return "";
				const runs = [];
				for (let y = 0; y < code.size; y += 1) {
					let x = 0;
					while (x < code.size) {
						if (!isDarkQrModule(code, x, y)) {
							x += 1;
							continue;
						}
						let width = 1;
						while (x + width < code.size && isDarkQrModule(code, x + width, y)) width += 1;
						runs.push("M" + String(x + QUIET) + " " + String(y + QUIET) + "h" + String(width) + "v1h-" + String(width) + "z");
						x += width;
					}
				}
				return runs.join("");
			}, [code]);
			if (code === void 0 || path === "") return null;
			const total = code.size + 8;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wb2-qrFrame",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					width: size,
					height: size,
					viewBox: "0 0 " + String(total) + " " + String(total),
					shapeRendering: "crispEdges",
					role: "img",
					"aria-label": "QR",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						width: total,
						height: total,
						fill: "#ffffff"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: path,
						fill: "#141413"
					})]
				})
			});
		}
		//#endregion
		//#region src/client/add-account.tsx
		/**
		* The add-account dialog: pick a realm, then finish sign-in.
		*
		* The flow starts by itself. Opening the dialog (or switching realm) mints a
		* challenge immediately — a "start" button in front of a QR code is a step whose
		* only outcome is the same QR code one second later.
		*
		* Two finishes, because the gateway offers two:
		*
		* 1. **Domestic — scan.** The challenge is a URL; it is drawn as a QR code, with
		*    copy/open/check as the escape hatches.
		* 2. **International — open in the browser.** The gateway cannot hand that realm's
		*    hand-off to a phone, so the dialog offers one emphasised button that opens
		*    the sign-in page, and polls in the background for the account to land.
		*
		* Token sign-in stays available for both realms: pasting an exported account is
		* the only route that needs no browser at all.
		*
		* @module dsh-workbuddy2api-gateway/client/add-account
		*/
		/** How often the dialog asks whether the browser finished. */
		const POLL_MS$1 = 4e3;
		/** The dialog. */
		function AddAccountDialog({ t, store, open, onClose, initialRealm }) {
			const snapshot = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
			const [realm, setRealm] = (0, react.useState)(initialRealm ?? "cn");
			const [mode, setMode] = (0, react.useState)("qr");
			const [token, setToken] = (0, react.useState)("");
			const [copied, setCopied] = (0, react.useState)(false);
			const login = snapshot.document?.login;
			const loginDone = snapshot.document?.loginDone;
			const activeLogin = login !== void 0 && login.realm === realm ? login : void 0;
			(0, react.useEffect)(() => {
				if (!open) return;
				store.start();
				return () => {
					store.stop();
				};
			}, [open, store]);
			(0, react.useEffect)(() => {
				if (!open || mode !== "qr") return;
				if (login !== void 0 && login.realm === realm) return;
				if (login !== void 0) {
					store.act({ action: "login-cancel" });
					return;
				}
				store.act({
					action: "login-start",
					realm
				}, "login-start");
			}, [
				open,
				mode,
				realm,
				login,
				store
			]);
			(0, react.useEffect)(() => {
				if (!open || activeLogin === void 0) return;
				const timer = setInterval(() => {
					store.act({
						action: "login-poll",
						state: activeLogin.state
					}, "login-poll");
				}, POLL_MS$1);
				return () => {
					clearInterval(timer);
				};
			}, [
				open,
				activeLogin?.state,
				store
			]);
			const doneBaseline = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!open) {
					doneBaseline.current = null;
					return;
				}
				if (doneBaseline.current === null) {
					doneBaseline.current = loginDone?.at ?? "";
					return;
				}
				if (loginDone?.at !== void 0 && loginDone.at !== doneBaseline.current) {
					doneBaseline.current = null;
					setToken("");
					onClose();
				}
			}, [
				open,
				loginDone?.at,
				onClose
			]);
			const submitToken = (0, react.useCallback)(() => {
				store.act({
					action: "import",
					payload: token
				}, "import").then(() => {
					setToken("");
					onClose();
				});
			}, [
				onClose,
				store,
				token
			]);
			if (!open) return null;
			const scan = mode === "qr" && realm === "cn";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wb2-overlay",
				role: "presentation",
				onClick: (event) => {
					if (event.target === event.currentTarget) onClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wb2-dialog",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("addAccountTitle"),
					style: {
						width: "min(360px, 92vw)",
						maxWidth: "min(360px, 92vw)"
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "wb2-dialogTitle",
							children: t("addAccountTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "wb2-dialogBody",
							children: t("addPickHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SegmentedField, {
							className: "cs-segFull",
							label: t("addRealm"),
							value: realm,
							onChange: (value) => {
								setRealm(value === "global" ? "global" : "cn");
							},
							options: [{
								value: "cn",
								label: t("accountRealmCn")
							}, {
								value: "global",
								label: t("accountRealmGlobal")
							}]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SegmentedField, {
							className: "cs-segFull",
							label: t("addMode"),
							value: mode,
							onChange: (value) => {
								setMode(value === "token" ? "token" : "qr");
							},
							options: [{
								value: "qr",
								label: realm === "global" ? t("addModeWeb") : t("addModeQr")
							}, {
								value: "token",
								label: t("addModeToken")
							}]
						}),
						mode === "token" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: "wb2-tokenArea",
								value: token,
								placeholder: t("addTokenPlaceholder"),
								onChange: (event) => {
									setToken(event.target.value);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "wb2-hint",
								children: t("addTokenHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wb2-dialogActions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
									label: t("addTokenSubmit"),
									tone: "primary",
									disabled: token.trim() === "",
									onClick: submitToken
								})
							})
						] }) : activeLogin === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "wb2-hint cs-center",
							children: t("addStarting")
						}) : scan ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(QrView, { value: activeLogin.url }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "wb2-hint cs-center",
								children: t("addWaiting")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wb2-dialogActions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wb2-linkButton",
									onClick: () => {
										navigator.clipboard?.writeText(activeLogin.url);
										setCopied(true);
										setTimeout(() => {
											setCopied(false);
										}, 1500);
									},
									children: copied ? t("copied") : t("copy")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
									label: t("addPoll"),
									onClick: () => {
										store.act({
											action: "login-poll",
											state: activeLogin.state
										}, "login-poll");
									}
								})]
							})
						] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							className: "cs-openButton",
							href: activeLogin.url,
							target: "_blank",
							rel: "noreferrer",
							children: t("addOpen")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "wb2-hint cs-center",
							children: t("addGlobalHint")
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "cs-dialogFull",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: t("addCancel"),
								onClick: () => {
									if (login !== void 0) store.act({ action: "login-cancel" });
									onClose();
								}
							})
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/glyph.tsx
		/** The glyph. */
		function GatewayGlyph({ size = 22 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "cs-glyph",
				width: size,
				height: size,
				viewBox: "0 0 512 512",
				"aria-hidden": "true",
				focusable: "false",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "46",
						strokeLinecap: "round",
						strokeLinejoin: "round",
						opacity: "0.85",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M256 232v44" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M256 276c0 42-40 60-74 82" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M256 276c0 42 40 60 74 82" })
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "256",
						cy: "178",
						r: "76",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "150",
						cy: "380",
						r: "62",
						fill: "currentColor",
						opacity: "0.65"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "362",
						cy: "380",
						r: "62",
						fill: "currentColor",
						opacity: "0.65"
					})
				]
			});
		}
		//#endregion
		//#region src/client/SettingsPage.tsx
		/**
		* The plugin's settings page: the gateway process, its accounts, its models, and
		* the connection that ties the three together.
		*
		* Every figure comes from the shared store, which reads the host's status
		* document; every write goes back through that store to the host, which re-reads
		* the gateway before answering. The page therefore never invents state: a toggle
		* shows the gateway's answer, not the click.
		*
		* The process tab is what makes this plugin more than a remote control. It shows
		* what was spawned, where its config and working directory are, how many times it
		* was restarted, and the tail of its output — so "the gateway is down" is a fact
		* with a log line next to it rather than a guess.
		*
		* @module dsh-workbuddy2api-gateway/client/SettingsPage
		*/
		/** Tab order: what the animation compares to decide the slide direction. */
		const TABS = [
			"overview",
			"accounts",
			"models",
			"gateway"
		];
		/** Relative time for the "updated" line, in the compact form the card uses. */
		function relativeTime(iso) {
			const then = Date.parse(iso);
			if (!Number.isFinite(then)) return iso;
			const seconds = Math.max(0, Math.round((Date.now() - then) / 1e3));
			if (seconds < 60) return String(seconds) + "s";
			if (seconds < 3600) return String(Math.round(seconds / 60)) + "m";
			return String(Math.round(seconds / 3600)) + "h";
		}
		/** A byte figure in the compact form the server card uses. */
		function formatBytes(value) {
			if (!Number.isFinite(value) || value <= 0) return "—";
			if (value >= 1048576) return (value / 1048576).toFixed(1) + " MB";
			if (value >= 1024) return String(Math.round(value / 1024)) + " KB";
			return String(value) + " B";
		}
		/** Status tone for one account. */
		function accountTone(account) {
			if (account.status === "active") return "ok";
			if (account.status === "cooling") return "warn";
			if (account.status === "disabled") return "error";
			return "off";
		}
		/** One account's status as words. */
		function accountStateText(account, t) {
			if (account.status === "active") return t("accountStatusActive");
			if (account.status === "cooling") return t("accountStatusCooling");
			if (account.status === "disabled") return t("accountStatusDisabled");
			return t("accountStatusPaused");
		}
		/** The page. */
		function WorkBuddy2ApiSettingsPage(props) {
			const { t, store } = props;
			const snapshot = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
			const [tab, setTab] = (0, react.useState)(props.initialTab ?? "overview");
			/** The page that is on its way out, with the direction it leaves in. */
			const [leaving, setLeaving] = (0, react.useState)(void 0);
			const lastTabIndex = (0, react.useRef)(0);
			const tabIndex = TABS.indexOf(tab);
			const direction = tabIndex < lastTabIndex.current ? "back" : "forward";
			(0, react.useEffect)(() => {
				lastTabIndex.current = tabIndex;
			}, [tabIndex]);
			const document = snapshot.document;
			(0, react.useEffect)(() => {
				store.start();
				return () => {
					store.stop();
				};
			}, [store]);
			(0, react.useEffect)(() => {
				if (snapshot.message === void 0) return;
				const timer = setTimeout(() => {
					store.dismissMessage();
				}, 8e3);
				return () => {
					clearTimeout(timer);
				};
			}, [snapshot.message, store]);
			const switchTab = (0, react.useCallback)((next) => {
				if (next === tab) return;
				const nextIndex = TABS.indexOf(next);
				setLeaving({
					tab,
					direction: nextIndex < tabIndex ? "back" : "forward"
				});
				setTab(next);
				setTimeout(() => {
					setLeaving(void 0);
				}, 140).unref?.();
			}, [tab, tabIndex]);
			const refresh = (0, react.useCallback)(() => {
				store.act({ action: "refresh" });
			}, [store]);
			if (document === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "wb2-section cs-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: "wb2-titleLg",
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "wb2-subtitle",
						children: t("intro")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: snapshot.error === void 0 ? "wb2-hint" : "wb2-rowError",
						children: snapshot.error === void 0 ? t("refreshing") : t("errorPrefix") + " " + snapshot.error
					})
				]
			});
			/** The body of one tab, shared by the entering and the leaving copy. */
			const renderTab = (which) => {
				if (which === "overview") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverviewTab, {
					t,
					store,
					document,
					pending: snapshot.pending,
					refresh
				});
				if (which === "accounts") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountsTab, {
					t,
					store,
					document,
					pending: snapshot.pending
				});
				if (which === "models") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelsTab, {
					t,
					store,
					document,
					pending: snapshot.pending
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(GatewayTab, {
					t,
					store,
					document,
					pending: snapshot.pending
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConnectionTab, {
					t,
					store,
					document,
					pending: snapshot.pending
				})] });
			};
			const tone = gatewayTone(document.gateway.state);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "wb2-section cs-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "wb2-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "wb2-headerText",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
									className: "wb2-titleLg cs-titleRow",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(GatewayGlyph, {}), t("title")]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "wb2-subtitle",
									children: t("intro")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "wb2-spacer" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: snapshot.pending === "refresh" ? t("refreshing") : t("refresh"),
								onClick: refresh
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wb2-inlineActions",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: tone === "ok" ? "ok" : tone === "error" ? "error" : tone === "warn" ? "warn" : "muted",
								children: gatewayStateText(document.gateway.state, t)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: document.panel.connected ? "ok" : "error",
								children: document.panel.connected ? t("connected") : t("disconnected")
							}),
							document.panel.version === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "muted",
								children: t("panelVersion", document.panel.version)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: document.provider.owned ? "muted" : "warn",
								children: document.provider.owned ? t("routeOwned", document.provider.id) : t("routeFallback", document.provider.id)
							}),
							document.provider.global === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: document.provider.global.owned ? "muted" : "warn",
								children: document.provider.global.owned ? t("routeOwned", document.provider.global.id) : t("routeFallback", document.provider.global.id)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "muted",
								children: t("versionLine", document.version)
							}),
							document.piAiVersion === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "muted",
								children: t("piAiVersion", document.piAiVersion)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wb2-hint",
								children: document.updatedAt === void 0 ? t("neverUpdated") : t("lastUpdated", relativeTime(document.updatedAt))
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SegmentedField, {
						label: t("title"),
						className: "cs-segFull",
						value: tab,
						onChange: (value) => {
							switchTab(value);
						},
						options: [
							{
								value: "overview",
								label: t("tabOverview")
							},
							{
								value: "accounts",
								label: t("tabAccounts")
							},
							{
								value: "models",
								label: t("tabModels")
							},
							{
								value: "gateway",
								label: t("gatewayTitle")
							}
						]
					}),
					snapshot.message === void 0 || snapshot.message.text === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: snapshot.message.kind === "error" ? "wb2-rowError" : "wb2-hint",
						children: snapshot.message.text
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "cs-page",
						children: [leaving === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "cs-pageBody",
							"data-leave": leaving.direction,
							children: renderTab(leaving.tab)
						}, "leave-" + leaving.tab), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "cs-pageBody",
							"data-enter": direction,
							children: renderTab(tab)
						}, tab)]
					})
				]
			});
		}
		/**
		* The overview: what the pool holds, in the same rhythm the dashboard uses.
		*
		* This is the page a user actually lands on, so it answers three questions in
		* order — how big is the pool, who is in it, and what can I do about it. Each
		* account keeps the card shape the dashboard already uses (avatar, state
		* capsules, three figures), which is what makes the two surfaces read as one
		* product rather than two pages over the same data.
		*/
		function OverviewTab(props) {
			const { t, store, document, pending, refresh } = props;
			const busy = pending !== void 0;
			const creditFor = (region) => {
				const known = document.accounts.filter((account) => (account.realm === "global" ? "global" : "cn") === region && account.credits !== void 0);
				return known.length === 0 ? void 0 : known.reduce((sum, account) => sum + (account.credits ?? 0), 0);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageCard, {
				t,
				usage: document.usage,
				creditsLeft: {
					cn: creditFor("cn"),
					global: creditFor("global")
				}
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SettingsGroup, {
				title: t("quickTitle"),
				description: t("quickDesc"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("refresh"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
							label: busy ? t("refreshing") : t("refresh"),
							disabled: busy,
							onClick: refresh
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("checkinAll"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
							label: t("checkinAll"),
							disabled: busy || document.counts.total === 0,
							onClick: () => {
								store.act({
									action: "bulk",
									op: "checkin_all"
								});
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("balanceAll"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
							label: t("balanceAll"),
							disabled: busy || document.counts.total === 0,
							onClick: () => {
								store.act({
									action: "bulk",
									op: "balance_all"
								});
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("syncHidden"),
						description: t("syncHiddenHint"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
							label: t("syncHidden"),
							disabled: busy || document.counts.hiddenModels === 0,
							onClick: () => {
								store.act({ action: "sync-hidden" });
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("autoRegister"),
						titleFor: "wb2-overview-auto-register",
						description: t("autoRegisterHint"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleField, {
							id: "wb2-overview-auto-register",
							label: t("autoRegister"),
							checked: document.sync.autoRegister,
							disabled: busy,
							onChange: (checked) => {
								store.act({
									action: "auto-register",
									enabled: checked
								}, "auto-register");
							}
						})
					})
				]
			})] });
		}
		/** Accounts: the gateway's account table, one add row underneath, and the dialog. */
		function AccountsTab(props) {
			const { t, store, document, pending } = props;
			const busy = pending !== void 0;
			const [confirmRemove, setConfirmRemove] = (0, react.useState)(void 0);
			const [addOpen, setAddOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SettingsGroup, {
				title: t("accountsTitle"),
				description: t("accountsDesc"),
				children: [document.accounts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "wb2-hint",
					children: t("accountsEmpty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "cs-tableWrap",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: "cs-table",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("colAccount") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("colState") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("creditsLabel") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("colSuccess") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("colUsage") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {})
						] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: document.accounts.map((account) => {
							const tone = accountTone(account);
							const name = account.nickname === "" ? t("noName") : account.nickname;
							const unlimited = account.creditsTotal === -1;
							const pct = unlimited ? 100 : account.creditsTotal !== void 0 && account.creditsTotal > 0 ? Math.min(100, Math.round((account.credits ?? 0) / account.creditsTotal * 100)) : 0;
							const expiry = account.tokenExpiresAt === void 0 ? void 0 : (() => {
								const at = Date.parse(account.tokenExpiresAt);
								if (!Number.isFinite(at)) return void 0;
								if (Math.floor((at - Date.now()) / 864e5) > 7 && account.hasRefreshToken) return void 0;
								return at <= Date.now() ? t("credentialExpired") : t("credentialExpiry", new Date(at).toISOString().slice(0, 10));
							})();
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "cs-cellWho",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "cs-nm",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, {
												tone,
												title: accountStateText(account, t)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												title: account.uid,
												children: name
											}),
											account.realm === "global" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
												tone: "muted",
												children: t("realmGlobalShort")
											}) : null,
											account.enterprise ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
												tone: "muted",
												children: t("enterpriseShort")
											}) : null
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "cs-uid",
										children: account.uid.length > 16 ? account.uid.slice(0, 16) + "…" : account.uid
									})]
								}) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "cs-cellState",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
											tone: tone === "ok" ? "ok" : tone === "error" ? "error" : tone === "warn" ? "warn" : "muted",
											children: accountStateText(account, t)
										}),
										account.disabledReason === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "cs-note",
											children: account.disabledReason
										}),
										account.rateLimitedModels === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "cs-note",
											children: t("accountRateLimited", account.rateLimitedModels)
										}),
										expiry === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "cs-note",
											children: expiry
										})
									]
								}) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
									className: "cs-cellCred",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: unlimited ? t("creditsUnlimited") : account.credits === void 0 ? "—" : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [account.credits, account.creditsTotal !== void 0 && account.creditsTotal > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "of",
										children: "/" + String(account.creditsTotal)
									}) : null] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "cs-credBar",
										role: "progressbar",
										"aria-valuemin": 0,
										"aria-valuemax": 100,
										"aria-valuenow": pct,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: { width: String(pct) + "%" } })
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
									className: "cs-num",
									children: [
										account.successCount,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dim",
											children: " / "
										}),
										account.failStreak
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
									className: "cs-num",
									children: [
										account.requestCount ?? 0,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dim",
											children: " · "
										}),
										account.totalTokens === void 0 ? "—" : formatTokens(account.totalTokens),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "cs-note",
											children: account.lastSuccess === void 0 ? "—" : new Date(account.lastSuccess).toISOString().slice(5, 16).replace("T", " ")
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "cs-acts",
									children: [
										account.enterprise ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
											label: account.checkinDone ? t("actionCheckinDone") : t("actionCheckin"),
											disabled: busy,
											onClick: () => {
												store.act({
													action: "account",
													uid: account.uid,
													op: "checkin"
												}, account.uid);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
											label: t("actionBalance"),
											disabled: busy,
											onClick: () => {
												store.act({
													action: "account",
													uid: account.uid,
													op: "balance"
												}, account.uid);
											}
										}),
										account.status === "disabled" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
											label: t("actionEnable"),
											tone: "primary",
											disabled: busy,
											onClick: () => {
												store.act({
													action: "account",
													uid: account.uid,
													op: "revive"
												}, account.uid);
											}
										}) : account.status === "paused" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
											label: t("actionResume"),
											tone: "primary",
											disabled: busy,
											onClick: () => {
												store.act({
													action: "account",
													uid: account.uid,
													op: "resume"
												}, account.uid);
											}
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
											label: t("actionPause"),
											disabled: busy,
											onClick: () => {
												store.act({
													action: "account",
													uid: account.uid,
													op: "pause"
												}, account.uid);
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
											label: t("actionDisable"),
											disabled: busy,
											onClick: () => {
												store.act({
													action: "account",
													uid: account.uid,
													op: "disable"
												}, account.uid);
											}
										})] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
											label: confirmRemove === account.uid ? t("actionRemoveConfirm") : t("actionRemove"),
											tone: "danger",
											disabled: busy,
											onClick: () => {
												if (confirmRemove !== account.uid) {
													setConfirmRemove(account.uid);
													return;
												}
												setConfirmRemove(void 0);
												store.act({
													action: "account",
													uid: account.uid,
													op: "remove"
												}, account.uid);
											}
										})
									]
								}) })
							] }, account.uid);
						}) })]
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "cs-addRow",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
						label: "+ " + t("addAccountTitle"),
						onClick: () => {
							setAddOpen(true);
						}
					})
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AddAccountDialog, {
				t,
				store,
				open: addOpen,
				onClose: () => {
					setAddOpen(false);
				}
			})] });
		}
		/** The separately downloaded server artifact. */
		function ServerCard(props) {
			const { t, store, server, pending } = props;
			const busy = pending !== void 0;
			const download = server.download;
			const pct = download.total > 0 ? Math.min(100, Math.max(0, Math.round(download.received / download.total * 100))) : 0;
			const working = download.state === "downloading" || download.state === "verifying" || download.state === "installing";
			const stateText = !server.supported ? t("serverStateUnsupported") : download.state === "downloading" ? t("serverStateDownloading") : download.state === "verifying" ? t("serverStateVerifying") : download.state === "installing" ? t("serverStateInstalling") : download.state === "failed" ? t("serverStateFailed") : download.state === "cancelled" ? t("serverStateCancelled") : server.installed ? t("serverStateReady") : t("serverStateMissing");
			const tone = server.installed ? "ok" : download.state === "failed" ? "error" : "warn";
			const rawError = download.error ?? server.error;
			const error = rawError === void 0 ? void 0 : rawError.includes("HTTP 404") ? t("serverErrorNotFound") : rawError.toLowerCase().includes("checksum") ? t("serverErrorChecksum") : rawError;
			const openRelease = () => {
				if (typeof window !== "undefined" && server.releaseUrl !== "") window.open(server.releaseUrl, "_blank", "noopener,noreferrer");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SettingsGroup, {
				title: t("serverTitle"),
				description: t("serverDesc"),
				action: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					download.state === "downloading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
						label: t("serverCancel"),
						disabled: busy,
						onClick: () => {
							store.act({ action: "server-cancel" }, "server-cancel");
						}
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
						label: server.installed ? t("serverVerify") : t("serverDownload"),
						tone: server.installed ? void 0 : "primary",
						disabled: busy || !server.supported,
						onClick: () => {
							store.act(server.installed ? { action: "server-verify" } : { action: "server-download" }, server.installed ? "server-verify" : "server-download");
						}
					}),
					!server.installed && (download.state === "failed" || download.state === "cancelled") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
						label: t("serverRetry"),
						disabled: busy,
						onClick: () => {
							store.act({ action: "server-download" }, "server-download");
						}
					}) : null,
					server.releaseUrl === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
						label: t("serverOpenRelease"),
						onClick: openRelease
					})
				] }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, {
								tone,
								title: stateText
							}),
							t("serverTitle"),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone,
								children: stateText
							})
						] }),
						error,
						description: server.installedVersion !== void 0 && server.installedVersion !== server.version ? t("serverUpdateAvailable", server.installedVersion, server.version) : void 0
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("serverVersion"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-mono",
							children: server.version
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("serverPlatform"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-mono",
							children: server.platform + " / " + server.arch
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("serverDownloadSize"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-mono",
							children: formatBytes(server.downloadSize) + " / " + formatBytes(server.size)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("serverChecksum"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-mono",
							children: server.sha256 === "" ? "—" : server.sha256.slice(0, 16) + "…"
						})
					}),
					server.binaryPath === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("serverPath"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-mono",
							children: server.binaryPath
						})
					}),
					working ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "cs-credBar",
						role: "progressbar",
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": pct,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: { width: pct + "%" } })
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "wb2-hint",
						children: t("serverProgress", pct, formatBytes(download.received), formatBytes(download.total))
					})] }) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "wb2-hint",
						children: t("serverPanelUpdateHint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "wb2-hint",
						children: t("serverManualHint")
					})
				]
			});
		}
		/** Kernel updates: the release channel, its cadence, and one-click install. */
		function KernelCard(props) {
			const { t, store, kernel, server, pending } = props;
			const busy = pending !== void 0;
			const tone = kernel.error !== void 0 ? "error" : kernel.available ? "warn" : "ok";
			const badgeTone = tone;
			const stateText = kernel.error !== void 0 ? t("kernelStateError") : kernel.installing ? t("kernelStateInstalling") : kernel.available ? t("kernelStateAvailable") : t("kernelStateIdle");
			const lastCheck = kernel.lastCheckedAt === void 0 ? "—" : new Date(kernel.lastCheckedAt).toLocaleString();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SettingsGroup, {
				title: t("kernelTitle"),
				description: t("kernelDesc"),
				action: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
					label: t("kernelCheck"),
					disabled: busy || kernel.installing,
					onClick: () => {
						store.act({ action: "kernel-check" }, "kernel-check");
					}
				}), kernel.available ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
					label: t("kernelInstall"),
					tone: "primary",
					disabled: busy || kernel.installing,
					onClick: () => {
						store.act({ action: "kernel-install" }, "kernel-install");
					}
				}) : null] }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, {
								tone,
								title: stateText
							}),
							t("kernelTitle"),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: badgeTone,
								children: stateText
							})
						] }),
						error: kernel.error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("kernelCadence"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SegmentedField, {
							label: t("kernelCadence"),
							value: kernel.cadence,
							disabled: busy || kernel.installing,
							onChange: (value) => {
								store.act({
									action: "kernel-cadence",
									cadence: value === "never" ? "never" : "hourly"
								}, "kernel-cadence");
							},
							options: [{
								value: "hourly",
								label: t("kernelCadenceHourly")
							}, {
								value: "never",
								label: t("kernelCadenceNever")
							}]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("kernelCurrent"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-mono",
							children: server.version
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("kernelLatest"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-mono",
							children: kernel.latestVersion ?? "—"
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("kernelLastCheck"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-mono",
							children: lastCheck
						})
					})
				]
			});
		}
		/** The process: state, controls, where it lives, and what it printed. */
		function GatewayTab(props) {
			const { t, store, document, pending } = props;
			const busy = pending !== void 0;
			const gateway = document.gateway;
			const server = document.server;
			const tone = gatewayTone(gateway.state);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServerCard, {
					t,
					store,
					server,
					pending
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(KernelCard, {
					t,
					store,
					kernel: document.kernel,
					server,
					pending
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SettingsGroup, {
					title: t("gatewayTitle"),
					description: t("gatewayDesc"),
					action: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						gateway.state === "running" || gateway.state === "external" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
							label: t("gatewayStart"),
							tone: "primary",
							disabled: busy || !server.installed || gateway.state === "host-unavailable",
							onClick: () => {
								store.act({ action: "gateway-start" }, "gateway-start");
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
							label: t("gatewayRestart"),
							disabled: busy || !server.installed,
							onClick: () => {
								store.act({ action: "gateway-restart" }, "gateway-restart");
							}
						}),
						gateway.managed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
							label: t("gatewayStop"),
							tone: "danger",
							disabled: busy,
							onClick: () => {
								store.act({ action: "gateway-stop" }, "gateway-stop");
							}
						}) : null
					] }),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
							title: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, {
									tone,
									title: gatewayStateText(gateway.state, t)
								}),
								t("gatewayTitle"),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
									tone: tone === "ok" ? "ok" : tone === "error" ? "error" : tone === "warn" ? "warn" : "muted",
									children: gatewayStateText(gateway.state, t)
								}),
								gateway.serverVersion === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
									tone: "muted",
									children: t("gatewayServerVersion", gateway.serverVersion)
								}),
								gateway.managed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
									tone: "muted",
									children: t("gatewayManaged")
								}) : null
							] }),
							error: gateway.error,
							description: gateway.state === "external" ? t("gatewayExternalHint") : gateway.restarts === 0 ? void 0 : t("gatewayRestarts", gateway.restarts),
							control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: t("testConnection"),
								disabled: busy,
								onClick: () => {
									store.act({ action: "test-connection" }, "test-connection");
								}
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
							title: t("gatewayBinary"),
							description: t("gatewayBinaryHint"),
							control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wb2-mono",
								children: gateway.binary ?? "—"
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
							title: t("gatewayWorkdir"),
							control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wb2-mono",
								children: gateway.workdir
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
							title: t("gatewayConfig"),
							control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wb2-mono",
								children: gateway.configPath
							})
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsGroup, {
					title: t("gatewayLog"),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: "wb2-tokenArea",
						style: {
							maxHeight: 240,
							overflow: "auto",
							whiteSpace: "pre-wrap",
							fontFamily: "var(--dsw-alias-font-mono,ui-monospace,Menlo,monospace)"
						},
						children: gateway.log.length === 0 ? t("gatewayLogEmpty") : gateway.log.map((line) => line.at.slice(11, 19) + " [" + line.stream + "] " + line.text).join(String.fromCharCode(10))
					})
				})
			] });
		}
		function ModelsTab(props) {
			const { t, store, document, pending } = props;
			const [query, setQuery] = (0, react.useState)("");
			const models = document.models;
			const [filter, setFilter] = (0, react.useState)("all");
			const regionOf = (model) => model.region ?? (model.id.startsWith("global:") ? "global" : "cn");
			const [region, setRegion] = (0, react.useState)("cn");
			const regionCounts = {
				cn: models.filter((model) => regionOf(model) === "cn").length,
				global: models.filter((model) => regionOf(model) === "global").length
			};
			const regionModels = models.filter((model) => regionOf(model) === region);
			const filtered = (0, react.useMemo)(() => {
				const needle = query.trim().toLowerCase();
				return regionModels.filter((model) => {
					if (filter === "checked" && !model.enabled) return false;
					if (needle === "") return true;
					return model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle);
				});
			}, [
				regionModels,
				query,
				filter
			]);
			const busy = pending !== void 0;
			const added = new Set(document.sync.added);
			const changed = new Set(document.sync.changed);
			if (models.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsGroup, {
				title: t("modelsTitle"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "wb2-hint",
					children: [
						t("modelsEmpty"),
						" ",
						t("modelsEmptyHint")
					]
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SettingsGroup, {
				title: t("modelsTitle"),
				description: t("modelsDesc"),
				action: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					className: "wb2-input",
					type: "search",
					placeholder: t("searchPlaceholder"),
					value: query,
					onChange: (event) => {
						setQuery(event.target.value);
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SegmentedField, {
					label: t("onlyCheckedHint"),
					value: filter,
					onChange: (value) => {
						setFilter(value === "checked" ? "checked" : "all");
					},
					options: [{
						value: "all",
						label: t("onlyCheckedAll")
					}, {
						value: "checked",
						label: t("onlyCheckedOnly")
					}]
				})] }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SegmentedField, {
						label: t("regionFilter"),
						value: region,
						onChange: (value) => {
							setRegion(value === "global" ? "global" : "cn");
						},
						options: [{
							value: "cn",
							label: t("regionCn") + " (" + String(regionCounts.cn) + ")"
						}, {
							value: "global",
							label: t("regionGlobal") + " (" + String(regionCounts.global) + ")"
						}]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("autoRegister"),
						titleFor: "wb2-auto-register",
						description: t("autoRegisterHint"),
						tag: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
							tone: document.sync.autoRegister ? "ok" : "muted",
							children: document.sync.autoRegister ? t("stateOn") : t("stateOff")
						}),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleField, {
							id: "wb2-auto-register",
							label: t("autoRegister"),
							checked: document.sync.autoRegister,
							disabled: busy,
							onChange: (checked) => {
								store.act({
									action: "auto-register",
									enabled: checked
								}, "auto-register");
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "cs-cardActions",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: t("enableAll"),
								disabled: busy,
								onClick: () => {
									store.act({
										action: "models-all",
										enabled: true,
										region
									});
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: t("disableAll"),
								disabled: busy,
								onClick: () => {
									store.act({
										action: "models-all",
										enabled: false,
										region
									});
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: t("syncHidden"),
								disabled: busy,
								onClick: () => {
									store.act({ action: "sync-hidden" });
								}
							})
						]
					}),
					filtered.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "wb2-hint",
						children: regionModels.length === 0 ? t("regionEmpty") : t("searchPlaceholder")
					}) : filtered.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							model.name,
							model.enabled ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "warn",
								children: t("modelHiddenBadge")
							}),
							added.has(model.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "ok",
								children: t("syncAdded", 1)
							}) : null,
							changed.has(model.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "muted",
								children: t("syncChanged", 1)
							}) : null,
							model.supportsImages ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "muted",
								children: t("modelVision")
							}) : null,
							model.credits === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: "muted",
								children: t("modelCredits", model.credits)
							})
						] }),
						description: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wb2-mono",
								children: model.id
							}),
							" · ",
							t("modelContext", formatTokens(model.contextLength)),
							" · ",
							t("modelOutput", formatTokens(model.maxOutputTokens))
						] }),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [model.efforts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-hint",
							children: t("modelNoEffort")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
							tone: "muted",
							children: model.efforts.join(" / ")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleField, {
							id: "model-toggle-" + model.id,
							label: model.name + " " + t("modelEnabled"),
							checked: model.enabled,
							disabled: busy,
							onChange: (checked) => {
								store.act({
									action: "model",
									id: model.id,
									enabled: checked
								}, "model:" + model.id);
							}
						})] })
					}, model.id))
				]
			}) });
		}
		/** Connection: the address, key, cadence, and sync policy. */
		function ConnectionTab(props) {
			const { t, store, document, pending } = props;
			const busy = pending !== void 0;
			const [panelUrl, setPanelUrl] = (0, react.useState)(document.connection.panelUrl);
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [refreshSeconds, setRefreshSeconds] = (0, react.useState)(String(document.connection.refreshSeconds));
			const [revealKey, setRevealKey] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				setPanelUrl(document.connection.panelUrl);
				setRefreshSeconds(String(document.connection.refreshSeconds));
			}, [document.connection.panelUrl, document.connection.refreshSeconds]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SettingsGroup, {
				title: t("settingsTitle"),
				description: t("settingsDesc"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("fieldPanelUrl"),
						titleFor: "wb2-panel-url",
						description: t("fieldPanelUrlHint"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							id: "wb2-panel-url",
							className: "wb2-input",
							value: panelUrl,
							disabled: busy,
							onChange: (event) => {
								setPanelUrl(event.target.value);
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("fieldApiKey"),
						titleFor: "wb2-panel-key",
						description: t("fieldApiKeyHint"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							id: "wb2-panel-key",
							className: "wb2-input",
							type: revealKey ? "text" : "password",
							placeholder: document.connection.hasApiKey ? "********" : t("fieldApiKeyPlaceholder"),
							value: apiKey,
							disabled: busy,
							onChange: (event) => {
								setApiKey(event.target.value);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "wb2-linkButton",
							onClick: () => {
								setRevealKey(!revealKey);
							},
							children: revealKey ? t("hideKey") : t("showKey")
						})] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("fieldRefresh"),
						titleFor: "wb2-refresh",
						description: t("fieldRefreshHint"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							id: "wb2-refresh",
							className: "wb2-input",
							type: "number",
							min: 10,
							max: 600,
							value: refreshSeconds,
							disabled: busy,
							onChange: (event) => {
								setRefreshSeconds(event.target.value);
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("fieldSync"),
						titleFor: "wb2-sync",
						description: t("fieldSyncHint"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleField, {
							id: "wb2-sync",
							label: t("fieldSync"),
							checked: document.connection.syncHiddenToPanel,
							disabled: busy,
							onChange: (checked) => {
								store.act({
									action: "connection",
									syncHiddenToPanel: checked
								}, "connection");
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("fieldProviderId"),
						description: t("fieldProviderIdHint"),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-mono",
							children: document.provider.id
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingRow, {
						title: t("syncTitle"),
						description: document.sync.lastSyncedAt === void 0 ? void 0 : t("lastUpdated", relativeTime(document.sync.lastSyncedAt)),
						control: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: document.sync.added.length === 0 ? "muted" : "ok",
								children: t("syncAdded", document.sync.added.length)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: document.sync.changed.length === 0 ? "muted" : "warn",
								children: t("syncChanged", document.sync.changed.length)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
								tone: document.sync.removed.length === 0 ? "muted" : "warn",
								children: t("syncRemoved", document.sync.removed.length)
							})
						] })
					})
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wb2-inlineActions",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
					label: pending === "connection" ? t("saving") : t("save"),
					tone: "primary",
					disabled: busy,
					onClick: () => {
						const seconds = Number.parseInt(refreshSeconds, 10);
						store.act({
							action: "connection",
							panelUrl,
							...apiKey.trim() === "" ? {} : { apiKey: apiKey.trim() },
							...Number.isFinite(seconds) ? { refreshSeconds: seconds } : {}
						}, "connection").then(() => {
							setApiKey("");
						});
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
					label: pending === "test-connection" ? t("testing") : t("testConnection"),
					disabled: busy,
					onClick: () => {
						store.act({ action: "test-connection" }, "test-connection");
					}
				})]
			})] });
		}
		//#endregion
		//#region src/catalog.ts
		/** Reasoning levels pi-ai can express, in display order. */
		const THINKING_LEVELS = [
			"off",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		/** Whether a value is a level this plugin can offer. */
		function isThinkingLevel(value) {
			return typeof value === "string" && THINKING_LEVELS.includes(value);
		}
		//#endregion
		//#region src/client/status-document.ts
		/** Status route path (mirrors the host constant). */
		const STATUS_PATH = "/plugins/workbuddy2api-gateway/status";
		/** Action route path (mirrors the host constant). */
		const ACTION_PATH = "/plugins/workbuddy2api-gateway/action";
		/** Shape-check a decoded status document. */
		function validStatus(value) {
			if (typeof value !== "object" || value === null) return false;
			const document = value;
			return document["ok"] === true && typeof document["controlKey"] === "string" && document["controlKey"].length > 0 && Array.isArray(document["models"]) && Array.isArray(document["accounts"]) && typeof document["connection"] === "object" && typeof document["counts"] === "object" && typeof document["gateway"] === "object" && typeof document["server"] === "object" && typeof document["kernel"] === "object";
		}
		/** Read the status document. Never throws. */
		async function readStatusDocument() {
			let response;
			try {
				response = await fetch(STATUS_PATH, { headers: { Accept: "application/json" } });
			} catch {
				return { state: "unreadable" };
			}
			if (!response.ok) return { state: "refused" };
			let body;
			try {
				body = await response.json();
			} catch {
				return { state: "unreadable" };
			}
			return validStatus(body) ? {
				state: "read",
				document: body
			} : { state: "unreadable" };
		}
		/** Post one action with the control key. Never throws. */
		async function postAction(action, controlKey) {
			try {
				const response = await fetch(ACTION_PATH, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						"x-dsh-plugin-key": controlKey
					},
					body: JSON.stringify(action)
				});
				const body = await response.json().catch(() => void 0);
				if (typeof body !== "object" || body === null) return {
					ok: false,
					message: "HTTP " + String(response.status)
				};
				const record = body;
				return {
					ok: record["ok"] === true,
					...typeof record["message"] === "string" ? { message: record["message"] } : {},
					...typeof record["error"] === "string" ? { message: record["error"] } : {},
					...typeof record["url"] === "string" ? { url: record["url"] } : {},
					...typeof record["state"] === "string" ? { state: record["state"] } : {},
					...typeof record["imported"] === "number" ? { imported: record["imported"] } : {},
					...typeof record["skipped"] === "number" ? { skipped: record["skipped"] } : {},
					...typeof record["status"] === "object" && record["status"] !== null ? { status: record["status"] } : {}
				};
			} catch (error) {
				return {
					ok: false,
					message: error instanceof Error ? error.message : String(error)
				};
			}
		}
		//#endregion
		//#region src/client/credit-badge.tsx
		/**
		* The composer's credit badge: the quota behind the model about to answer.
		*
		* The plugin registers two providers — the domestic route and the global route
		* — and their credits are not interchangeable. The badge therefore reads the
		* session's current model selection, picks the matching realm, and sums only
		* that realm's accounts. A model under another provider renders nothing: a
		* WorkBuddy figure attached to a turn that cannot spend it is worse than no
		* figure at all.
		*
		* It renders nothing when there is nothing to say: no gateway connection, no
		* matching accounts, or no credit figure at all. An annotation must never be a
		* requirement, and an empty "0" reads as a spent pool rather than as an unknown
		* one.
		*
		* @module dsh-workbuddy2api-gateway/client/credit-badge
		*/
		/** Compact a credit figure: 4160 → 4,160. */
		function grouped(value) {
			return new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 }).format(value);
		}
		/**
		* Render the selected realm's remaining credit, or nothing.
		*
		* The poll starts with the mount and stops with it, exactly like the settings
		* page's: the badge is a second reader of the same store, not a second poller.
		*/
		function WorkBuddy2ApiCreditBadge({ t, store, directory }) {
			const snapshot = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
			const subscribeDirectory = (0, react.useCallback)((listener) => directory.subscribe(listener), [directory]);
			const readDirectory = (0, react.useCallback)(() => directory.getSnapshot(), [directory]);
			const selection = (0, react.useSyncExternalStore)(subscribeDirectory, readDirectory, readDirectory).current;
			(0, react.useEffect)(() => {
				store.start();
				return () => {
					store.stop();
				};
			}, [store]);
			const persistedEfforts = (0, react.useRef)(/* @__PURE__ */ new Map());
			(0, react.useEffect)(() => {
				const currentSelection = selection;
				const currentDocument = snapshot.document;
				if (currentSelection === null || currentDocument === void 0) return;
				if (!isThinkingLevel(currentSelection.reasoningEffort)) return;
				const provider = currentSelection.provider;
				const globalId = currentDocument.provider.global?.id;
				if (provider !== currentDocument.provider.id && provider !== globalId) return;
				const model = currentDocument.models.find((entry) => entry.id === currentSelection.model);
				if (model === void 0 || model.defaultEffort === currentSelection.reasoningEffort) return;
				const modelKey = provider + "|" + currentSelection.model;
				const key = modelKey + "|" + currentSelection.reasoningEffort;
				if (persistedEfforts.current.get(modelKey) === key) return;
				persistedEfforts.current.set(modelKey, key);
				postAction({
					action: "model",
					id: currentSelection.model,
					effort: currentSelection.reasoningEffort
				}, currentDocument.controlKey).then((response) => {
					if (!response.ok && persistedEfforts.current.get(modelKey) === key) persistedEfforts.current.delete(modelKey);
				});
			}, [selection, snapshot.document]);
			const document = snapshot.document;
			if (document === void 0 || !document.panel.connected || document.accounts.length === 0) return null;
			if (selection === null) return null;
			const realm = selection.provider === document.provider.global.id ? "global" : selection.provider === document.provider.id ? "cn" : void 0;
			if (realm === void 0) return null;
			const known = document.accounts.filter((account) => (account.realm === "global" ? "global" : "cn") === realm && account.credits !== void 0);
			if (known.length === 0) return null;
			const total = known.reduce((sum, account) => sum + (account.credits ?? 0), 0);
			const label = realm === "global" ? t("creditsLeftGlobal") : t("creditsLeftCn");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "cs-creditBadge",
				title: t("creditsLeftHint"),
				children: [label, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: grouped(total) })]
			});
		}
		//#endregion
		//#region src/client/store.ts
		/**
		* One shared snapshot for every surface of the plugin.
		*
		* The sidebar card, the dashboard, and the settings page all read this store, so
		* a single poll feeds all of them and they cannot disagree about what the panel
		* said. It is deliberately React-free: components subscribe through
		* `useSyncExternalStore`, and the Node tests drive it without a DOM.
		*
		* Writes are optimistic only in the sense that they *report* — the snapshot is
		* replaced by the one the action returns (the host re-reads the panel after
		* every write), so a surface never shows a toggle state the panel did not
		* accept.
		*
		* @module dsh-workbuddy2api-connect/client/store
		*/
		/** Poll cadence while a surface is mounted; the host refreshes its own copy. */
		const POLL_MS = 5e3;
		/** Faster cadence while a server download is in flight. */
		const POLL_FAST_MS = 1e3;
		/** The shared store. */
		var PanelStore = class {
			listeners = /* @__PURE__ */ new Set();
			snapshot = { loading: true };
			timer;
			refs = 0;
			inFlight;
			pollMs = POLL_MS;
			/** Subscribe; returns the disposer React's `useSyncExternalStore` wants. */
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			/** The current snapshot (stable between changes). */
			getSnapshot = () => this.snapshot;
			/** Apply a patch and notify every surface. */
			set(patch) {
				this.snapshot = {
					...this.snapshot,
					...patch
				};
				for (const listener of this.listeners) listener();
			}
			/** Replace the document from a read or an action's reply. */
			adopt(document) {
				if (document === void 0) return;
				this.set({
					document,
					loading: false,
					error: void 0
				});
				const next = document.server.download.state === "downloading" ? POLL_FAST_MS : POLL_MS;
				if (next !== this.pollMs) {
					this.pollMs = next;
					if (this.timer !== void 0) this.schedule();
				}
			}
			/** Re-arm the interval at the current cadence. */
			schedule() {
				if (this.timer !== void 0) clearInterval(this.timer);
				this.timer = setInterval(() => {
					this.refresh();
				}, this.pollMs);
			}
			/** Read the status document. Concurrent calls share one request. */
			async refresh() {
				if (this.inFlight !== void 0) return this.inFlight;
				this.inFlight = (async () => {
					const read = await readStatusDocument();
					if (read.state === "read") {
						this.adopt(read.document);
						return;
					}
					this.set({
						loading: false,
						error: read.state === "refused" ? "status route refused the request" : "status document unavailable"
					});
				})().finally(() => {
					this.inFlight = void 0;
				});
				return this.inFlight;
			}
			/** Send one write and fold its answer into the snapshot. */
			async act(action, pendingKey) {
				const document = this.snapshot.document;
				if (document === void 0) return;
				this.set({
					pending: pendingKey ?? action.action,
					message: void 0
				});
				const response = await postAction(action, document.controlKey);
				if (response.status !== void 0) this.adopt({
					...document,
					...response.status,
					controlKey: document.controlKey
				});
				this.set({
					pending: void 0,
					message: {
						kind: response.ok ? action.action === "test-connection" || action.action === "refresh" ? "notice" : "ok" : "error",
						text: response.message ?? (response.ok ? "" : "request failed")
					}
				});
			}
			/** Drop the message line (the page calls this after a timeout). */
			dismissMessage() {
				if (this.snapshot.message === void 0) return;
				this.set({ message: void 0 });
			}
			/** Start polling; idempotent, reference-counted by mounted surfaces. */
			start() {
				this.refs += 1;
				if (this.timer === void 0) {
					this.refresh();
					this.schedule();
				}
			}
			/** Stop polling once the last surface unmounts. */
			stop() {
				this.refs = Math.max(0, this.refs - 1);
				if (this.refs > 0) return;
				if (this.timer !== void 0) {
					clearInterval(this.timer);
					this.timer = void 0;
				}
			}
		};
		/** The one store every surface shares. */
		const panelStore = new PanelStore();
		//#endregion
		//#region src/client/ui-styles.ts
		/**
		* Two stylesheets for the WorkBuddy surfaces: the settings page (and the
		* Models-page provider card, which shares its classes) and the plans panel
		* (the sidebar footer card plus the dashboard it opens).
		*
		* Returned as strings rather than injected here so the modules stay free of DOM
		* side effects at import time: `./index.tsx` installs each once, keyed by its
		* own `data-plugin-css` id. The metrics are the harness's own settings pages'
		* — read out of the 0.1.7 bundles so these surfaces sit beside General and
		* Models without looking foreign: a row is 16px of padding over a 0.5px
		* border-l2 hairline, its title 14/22 label-primary, its description 12/18
		* label-tertiary, the control on the right. Inputs are 32px with an 8px radius,
		* a card is a 0.5px border-l4 outline with a 16px radius, a nested panel is a
		* bg-module-platform fill.
		*
		* Two design rules hold throughout, both learned from the reference
		* implementation this is ported from (dsh-commandcode-provider):
		*
		* - **No literal colours.** Every value is a `--dsw-alias-*` token with a
		*   neutral fallback, so the page follows the active theme, light or dark.
		*   Literal colours get this wrong in exactly one mode: `brand-primary`
		*   inverts between them, so a hardcoded white thumb vanishes in dark mode.
		* - **The content column is a fixed 720px稿纸.** The page is a stack of
		*   groups of hairline-separated rows — no card surfaces — which is what makes
		*   it read as a settings page rather than as a dashboard.
		*
		* The `wb2-` prefix is kept (rather than the reference's `cc-`) because these
		* rules are GLOBAL CSS: another plugin's stylesheet with the same prefix would
		* silently restyle these surfaces, and the reference plugin is installed on
		* this machine.
		*
		* @module dsh-workbuddy-connect/client/ui-styles
		*/
		/** Idempotency key for the settings-page stylesheet. */
		const PAGE_CSS_ID = "dsh-workbuddy2api-connect-page";
		/** Idempotency key for the panel stylesheet. */
		const PANEL_CSS_ID = "dsh-workbuddy2api-connect-panel";
		/**
		* The settings-page stylesheet: a 720px column of groups, each a heading over
		* hairline-separated rows, plus the fields, toggles, segmented controls,
		* account cards and dialogs the page composes from it.
		*/
		const PAGE_CSS = `
.wb2-section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;display:flex;gap:16px}
.wb2-spacer{flex:1}
/* Groups: a heading over hairline-separated rows, no card surface. */
.wb2-group{flex-direction:column;display:flex;margin-top:28px}
.wb2-groupHead{align-items:center;gap:8px;display:flex;min-height:20px;padding-bottom:2px}
.wb2-groupTitle{margin:0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
.wb2-groupDesc{margin:0 0 12px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-rows>.wb2-groupDesc{margin:0;padding:4px 0 0}
.wb2-rows{flex-direction:column;display:flex}
.wb2-row{align-items:center;gap:8px;display:flex;padding:10px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.wb2-rows>.wb2-row:last-child{border-bottom:0}
.wb2-rowNested{padding-left:16px}
.wb2-rowFlush{padding:0;border-bottom:0}
.wb2-rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:32px;display:flex}
.wb2-rowTitleLine{align-items:center;gap:8px;display:flex;min-width:0}
.wb2-rowTitle{min-width:0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px;display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
.wb2-rowDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-rowDesc p{margin:0}
.wb2-rowDesc p+p{margin-top:4px}
.wb2-rowError{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.wb2-rowControl{flex:none;align-items:center;justify-content:flex-end;gap:8px;display:inline-flex;max-width:60%}
/* The platform's link button: a compact capsule with no fill until hovered. */
.wb2-linkButton{box-sizing:border-box;flex:none;align-items:center;display:inline-flex;height:28px;padding:0 10px;border:0;border-radius:14px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer}
.wb2-linkButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.wb2-linkButton:disabled{cursor:default;opacity:.4}
.wb2-linkButton:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
/* Tags: the platform Tag's capsule (11/17, weight 500). */
/* A label paired with a value on one baseline (the total-credit line). */
.wb2-factLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-factValue{color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
/* The stacked field (the Models-page provider card and the account forms):
 * the platform SettingsForm field's metrics. */
.wb2-fieldHead{align-items:center;gap:8px;display:flex}
.wb2-label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}
.wb2-input{box-sizing:border-box;height:32px;min-width:0;padding:0 10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font:inherit;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.wb2-input::placeholder{color:var(--dsw-alias-label-dimmed)}
.wb2-input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}
.wb2-input:disabled{opacity:.6;cursor:default}
.wb2-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}
/* An informational outcome (a save that took an older host's route): the same
 * metrics as the error line and the other colour, so it reads as a note. */
.wb2-notice{color:var(--dsw-alias-state-warn-label,var(--dsw-alias-label-tertiary));margin:0;font-size:12px;line-height:18px}
/* The checkbox, drawn rather than native: color-scheme is set once at BOOT and
 * is not re-applied when the theme is switched in-session, so a native box can
 * paint light chrome on a dark page. The mark rides brand-primary, so it takes
 * the theme's foreground for that fill. */
.wb2-check{box-sizing:border-box;appearance:none;flex-shrink:0;width:16px;height:16px;margin:0;border:1px solid var(--dsw-alias-border-l3);border-radius:4px;background:0 0;position:relative}
.wb2-check:checked{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.wb2-check:checked::after{content:'';position:absolute;top:3px;left:5px;width:3px;height:7px;border:solid var(--dsw-alias-label-primary-foreground,#fff);border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
.wb2-check:disabled{cursor:default;opacity:.4}
.wb2-checkRow{align-items:center;gap:8px;display:inline-flex;min-width:0}
.wb2-checkRow:hover{cursor:pointer}
.wb2-checkName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The platform Switch: a 36x20 capsule padding its track by 2px, sliding a
 * 16px thumb across the 32px content box. corner-shape:round on both the track
 * and the thumb keeps the capsule from squaring its ends around a round thumb. */
.wb2-toggle{box-sizing:border-box;appearance:none;flex-shrink:0;width:36px;height:20px;margin:0;padding:2px;border:0;border-radius:10px;corner-shape:round;background:var(--dsw-alias-border-l3);cursor:pointer;position:relative}
.wb2-toggle:checked{background:var(--dsw-alias-brand-primary)}
.wb2-toggle::after{content:'';display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary-foreground);transition:transform .12s ease}
.wb2-toggle:checked::after{transform:translateX(16px)}
.wb2-toggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.wb2-toggle:disabled{cursor:default;opacity:.5}
/* The platform SegmentedControl: a translucent track with one raised pill that
 * slides under the picked segment. Segments are equal grid tracks, so the
 * indicator's width and offset follow from the count and index alone — no DOM
 * measurement. */
.wb2-segmented{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;padding:4px;border-radius:var(--dsw-radius-md,9px);background:var(--dsw-alias-interactive-bg-hover)}
.wb2-segmentIndicator{position:absolute;top:4px;left:4px;width:calc((100% - 8px - 2px * (var(--wb2-segment-count) - 1)) / var(--wb2-segment-count));height:calc(100% - 8px);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-soft,0 1px 2px rgba(0,0,0,.12));transform:translateX(calc(var(--wb2-segment-index) * (100% + 2px)));transition:transform .16s ease;pointer-events:none}
.wb2-segment{box-sizing:border-box;position:relative;z-index:1;height:28px;padding:0 16px;border:0;border-radius:var(--dsw-radius-sm,6px);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;font-weight:500;line-height:20px;white-space:nowrap;cursor:pointer;transition:color .12s ease}
.wb2-segment:hover:not(:disabled),.wb2-segment[aria-checked=true]{color:var(--dsw-alias-label-primary)}
.wb2-segment:disabled{cursor:default;opacity:.4}
/* ------------------------------------------------- the model picker menu */
/* The multi-select trigger: the platform's selector capsule (the reference
 * implementation's .cc-selector, same numbers). */
.wb2-modelSelectAnchor{flex-direction:column;align-items:stretch;gap:6px;display:inline-flex;min-width:160px}
.wb2-selector{box-sizing:border-box;align-items:center;gap:12px;display:inline-flex;height:36px;padding:0 14px;border:0;border-radius:18px;corner-shape:round;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;text-align:left;cursor:pointer}
.wb2-selector:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.wb2-selector:disabled{cursor:default;opacity:.4}
.wb2-selector:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.wb2-selectorText{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb2-selectorCaret{flex-shrink:0;border-right:1.5px solid var(--dsw-alias-label-tertiary);border-bottom:1.5px solid var(--dsw-alias-label-tertiary);width:6px;height:6px;margin-bottom:3px;transform:rotate(45deg)}
/* The portaled list needs its own floor: the models are long names, and a menu
 * clamped to the trigger's width would ellipsis the part that tells two of them
 * apart. */
.wb2-modelMenu{min-width:240px}
/* The search box sits INSIDE the Menu anchor, so typing in it never trips the
 * Menu's outside-click close. */
.wb2-modelSearch{width:100%}
.wb2-modelSearch::-webkit-search-cancel-button{cursor:pointer}
/* A model the filter excludes: the platform's muted dot, the same mark the
 * reference implementation's account default-state column uses. */
.wb2-modelFiltered{flex-shrink:0;width:6px;height:6px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-dimmed,var(--dsw-alias-label-tertiary))}
/* Three dots from one element: the dot itself plus two box-shadow copies (the
 * reference implementation's .cc-kebab). */
.wb2-kebab{width:3px;height:3px;border-radius:50%;corner-shape:round;background:currentColor;box-shadow:0 -5px 0 currentColor,0 5px 0 currentColor}
/* ------------------------------------------------ account meters (cc port) */
/* ------------------------------------------- the add-account affordance */
/* The Models page's dashed add button, opening a filled panel in its place. */
/* ------------------------------------------------------ staged edit bar (cc port) */
/* The floating save bar, pinned to the bottom of the page's scrollport and slid
 * out of view when there is nothing to save. Ported from the reference
 * implementation's .cc-saveBar: a 44px capsule, 22px radius, concentric 36px
 * buttons, and a leading tone dot. */
.wb2-saveBarDock{position:sticky;bottom:0;z-index:20;height:0;pointer-events:none}
.wb2-saveBar{--wb2-saveBar-tone:var(--dsw-alias-state-warn-primary,#d97706);position:absolute;left:50%;bottom:20px;box-sizing:border-box;width:max-content;max-width:calc(100% - 24px);align-items:center;gap:10px;display:flex;height:44px;padding:4px 4px 4px 16px;border:0;border-radius:22px;corner-shape:round;background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-prominent,0 12px 32px -8px rgba(0,0,0,.24),0 2px 8px rgba(0,0,0,.08));opacity:0;visibility:hidden;transform:translate(-50%,12px);transition:opacity .16s ease,transform .16s ease,visibility 0s linear .16s}
.wb2-saveBarShown{opacity:1;visibility:visible;transform:translate(-50%,0);pointer-events:auto;transition:opacity .2s ease,transform .24s cubic-bezier(.2,.9,.3,1.1),visibility 0s}
.wb2-saveBarError{--wb2-saveBar-tone:var(--dsw-alias-state-error-primary)}
.wb2-saveBarSuccess{--wb2-saveBar-tone:var(--dsw-alias-state-success-primary,#16a34a);padding-right:18px}
.wb2-saveBarIcon{flex-shrink:0;align-items:center;justify-content:center;display:inline-flex;width:16px;height:16px;color:var(--wb2-saveBar-tone)}
.wb2-saveBarPulse{width:8px;height:8px;border-radius:50%;corner-shape:round;background:var(--wb2-saveBar-tone)}
.wb2-saveBarText{min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.wb2-saveBarError .wb2-saveBarText{color:var(--dsw-alias-state-error-primary)}
.wb2-saveBarActions{flex-shrink:0;align-items:center;gap:4px;display:flex;margin-left:8px}
.wb2-saveBarButton{box-sizing:border-box;height:36px;padding:0 16px;border:0;border-radius:18px;corner-shape:round;font:inherit;font-size:14px;line-height:22px;white-space:nowrap;cursor:pointer}
.wb2-saveBarButton:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.wb2-saveBarButton:disabled{cursor:default;opacity:.4}
.wb2-saveBarGhost{background:0 0;color:var(--dsw-alias-label-primary)}
.wb2-saveBarGhost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.wb2-saveBarPrimary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground,#fff)}
.wb2-saveBarPrimary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary)))}
/* ------------------------------------------------------------- accounts */
/* One card per PRODUCT, every account of that product as a row inside it.
 * The card is the platform's outlined surface (0.5px border-l4, 16px radius),
 * because it groups rows rather than being a row itself; the rows inside carry
 * no chrome at all, only a hairline between them. */
.wb2-productCards{flex-direction:column;gap:12px;display:flex}
.wb2-productCard{box-sizing:border-box;flex-direction:column;display:flex;padding:12px 14px 4px;border:.5px solid var(--dsw-alias-border-l4);border-radius:16px;min-width:0}
.wb2-productHead{align-items:center;gap:8px;display:flex;min-width:0;padding-bottom:8px}
.wb2-productName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
.wb2-productCount{flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-productTotal{flex:none;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;font-variant-numeric:tabular-nums;white-space:nowrap}
.wb2-productDetail{margin:0 0 8px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-accountList{flex-direction:column;display:flex;min-width:0}
/* One account: a name line and ONE grey line under it. No disclosure, no
 * per-account card — the pool is one subject and its rows are comparable only
 * when they share a frame. The hairline separates rows, and the last row drops
 * it so the card's own border is the only line at the bottom. */
.wb2-accountRow{flex-direction:column;gap:2px;display:flex;min-width:0;padding:10px 2px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.wb2-accountList>.wb2-accountRow:last-child{border-bottom:0}
/* The account the pool is actually serving from: the reference
 * implementation's own active-row mark, kept as a left accent rather than a
 * border so it does not shift the row's text by a pixel when it flips. */
.wb2-accountRowActive{padding-left:8px;box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.wb2-accountHead{align-items:center;gap:8px;display:flex;min-width:0;min-height:22px}
.wb2-accountName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
/* The grey meta line: every figure the row states, separated by a middot. It
 * wraps rather than truncates — a figure the reader cannot see is worse than a
 * second line — and its numbers are tabular so rows line up down the column. */
.wb2-accountMeta{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.wb2-usagePlanStatus{flex:none;margin:0;white-space:nowrap;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.wb2-iconButton{flex-shrink:0;align-items:center;justify-content:center;display:inline-flex;width:28px;height:28px;padding:0;background:0 0;border:0;border-radius:6px;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.wb2-iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.wb2-iconButton:disabled{cursor:default;opacity:.4}
.wb2-iconButton:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.wb2-inlineForm,.wb2-confirmBar{flex-direction:column;gap:8px;display:flex}
.wb2-inlineActions{align-items:center;gap:8px;display:flex;flex-wrap:wrap}
.wb2-confirmBar{border:.5px solid var(--dsw-alias-state-error-primary);border-radius:12px;padding:12px 14px}
.wb2-confirmText{color:var(--dsw-alias-label-primary);margin:0;font-size:14px;line-height:22px}
/* Adding an account: the Models page's dashed add button, opening a filled
 * panel in its place. */
/* Account report: stat tiles are filled panels, like the platform's editors. */
/* The per-product total tiles sit under the account cards, so they need the
 * same air the add button gets — flush against the last card they read as part
 * of it. The reference implementation has no equivalent row, so this spacing is
 * ours to set. */
.wb2-usageStat{min-width:0;flex-direction:column;gap:2px;display:flex;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-module-platform)}
.wb2-usageStatLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-usageStatValue{color:var(--dsw-alias-label-primary);font-size:16px;font-weight:500;line-height:24px;font-variant-numeric:tabular-nums}
.wb2-usageStatSub{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Tabs across the top of the page: one per product. */
/* --------------------------------------------------------------- models */
/* Realm heading between model rows: domestic block first, international second. */
.wb2-modelGroup{align-items:center;gap:8px;display:flex;margin:16px 0 2px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;line-height:18px}
.wb2-modelGroup:first-child{margin-top:4px}
.wb2-modelRow{align-items:center;gap:8px;display:flex;padding:10px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
/* The row's left half: the mark, the name, its promotions and its rate. Grows to take the space the fixed control column leaves. */
.wb2-modelMain{align-items:center;gap:8px;display:flex;flex:1;min-width:0}
.wb2-modelName{min-width:0;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The row's right-hand column, as a fixed grid so the rows line up top to
 * bottom: one column per slot (probe result, Detect button, context figure),
 * each sized to its widest occupancy. Flow layout could not hold a column — a
 * row without a Detect button would pull its context figure left, and the
 * figures would read as ragged down the page even though every row is
 * individually correct.
 *
 * The two fixed tracks are the widths of the button and of the context figure
 * at their widest real content, so a row can be missing either without shifting
 * the other. The first track is auto so the result badge takes what it needs;
 * justify-items:end keeps every cell flush right, which is what makes the
 * column's edge straight. */
.wb2-modelControl{flex:none;align-items:center;display:grid;grid-template-columns:auto 76px minmax(120px,auto);gap:8px;justify-items:end}
.wb2-modelProbeResult{display:inline-flex;justify-content:flex-end;min-width:0}
.wb2-modelProbeAction{display:inline-flex;justify-content:flex-end}
.wb2-modelContext{display:inline-flex;justify-content:flex-end;align-items:center;text-align:right;white-space:nowrap}
/* --------------------------------------------------------------- dialogs */
/* The overlay portals to document.body (see WorkBuddySettingsPage), so its
   z-index is compared in the ROOT stacking context — against the host's own
   chrome, not just this page. The host stacks its shell and chat surfaces up
   to z-index 1100 and reserves layers beyond that; the original 60 sat behind
   the Settings surface the dialog was opened from, so the click meant to
   dismiss the dialog landed on Settings instead — and closing Settings
   unmounted the dialog with it. Pinned near the top of the 32-bit range: a
   modal this plugin opens must never interleave with host chrome. */
.wb2-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask,rgba(0,0,0,.45))}
@keyframes cs-overlay-in{from{opacity:0}to{opacity:1}}
@keyframes cs-dialog-in{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
.wb2-overlay{animation:cs-overlay-in .16s ease}
.wb2-dialog{box-sizing:border-box;width:100%;max-width:380px;display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:16px;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-prominent,0 12px 32px -8px rgba(0,0,0,.24));animation:cs-dialog-in .2s cubic-bezier(.22,1,.36,1)}
.wb2-dialogTitle{margin:0;color:var(--dsw-alias-label-primary);font-size:16px;line-height:24px;font-weight:500;text-align:center}
.wb2-dialogBody{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;text-align:center}
.wb2-dialogActions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
.wb2-qrFrame{display:flex;align-items:center;justify-content:center;margin:0 auto;padding:12px;border-radius:12px;background:#fff}
.wb2-tokenArea{box-sizing:border-box;width:100%;min-height:96px;padding:10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;resize:vertical}
/* The address of a page no strategy could open: a copy target, so it stays
 * selectable and reads in the same field style as the other inputs. */
.wb2-linkFallback{display:flex;flex-direction:column;gap:8px}
.wb2-linkFallback .wb2-input{font-size:12px}
.wb2-tokenArea:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}
/* Identifiers (route ids, model ids, account uids) are compared and copied, so
 * they get the monospace treatment and stay selectable. */
.wb2-rowDimmed{opacity:.6}
/* ------------------------------------------------- Claude-style surfaces
   The overview widget, its heat map, and the card treatment the account and
   model sections share: soft fills, no hard outlines, figures that lead. */
/* Segmented control: the track is the theme's chip surface, the active pill is
   the theme's overlay surface with a soft shadow. Copied from dsh-claude-style's
   .dsh-claude-segments / .dsh-claude-segment pair; the fallbacks keep the track
   visible when the theme is not installed. */
.cs-seg{flex:none;align-self:flex-start;align-items:center;gap:2px;padding:2px;border-radius:7px;background:var(--dsh-claude-chip,var(--dsw-alias-bg-layer-2,#ffffff14));display:inline-flex;position:relative}
.cs-seg::before{content:"";position:absolute;top:2px;left:2px;height:calc(100% - 4px);width:calc((100% - 4px - 2px * (var(--cs-seg-count,2) - 1)) / var(--cs-seg-count,2));border-radius:7px;background:var(--dsw-alias-bg-overlay,#ffffff24);box-shadow:0 1px 2px #14141314;transform:translateX(calc(var(--cs-seg-index,0) * (100% + 2px)));transition:transform .18s cubic-bezier(.2,.8,.2,1)}
.cs-segFull{display:flex;width:100%}
.cs-segDisabled{opacity:.55;pointer-events:none}
.cs-segItem{appearance:none;margin:0;border:0;cursor:pointer;position:relative;z-index:1;flex:1 1 0;white-space:nowrap;text-align:center;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px;font-weight:500;line-height:18px;padding:3px 12px;border-radius:7px;transition:background-color .16s ease,color .16s ease}
.cs-segItem:hover:not([data-active="true"]){color:var(--dsw-alias-label-primary)}
.cs-segItem[data-active="true"]{color:var(--dsw-alias-label-primary);background:transparent;box-shadow:none}
.cs-segItem:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.cs-usage{display:flex;flex-direction:column;gap:12px;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);border:0}
.cs-usageHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cs-usageTitle{font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.cs-spacer{flex:1}
.cs-usageGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.cs-stat{display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-interactive-bg-hover)}
.cs-statLabel{font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.cs-statValue{font-size:20px;line-height:1.25;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-statValueSmall{font-size:14px;line-height:1.35;font-weight:600;white-space:normal;overflow:visible;text-overflow:clip}
/* Heat map: one 7-row column-flow grid, 1fr columns, 3px gaps, square cells.
   Copied from dsh-claude-style's .dsh-claude-home-heat / -heat-cell. */
.cs-heat{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,1fr);grid-auto-columns:1fr;gap:2px;align-content:start;--cs-heat-ink:var(--dsw-alias-brand-primary,#3b6ecf)}
.cs-heatCell{position:relative;width:100%;aspect-ratio:1;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent)}
.cs-heatCell[data-level="1"]{background:color-mix(in srgb,var(--cs-heat-ink) 20%,transparent)}
.cs-heatCell[data-level="2"]{background:color-mix(in srgb,var(--cs-heat-ink) 40%,transparent)}
.cs-heatCell[data-level="3"]{background:color-mix(in srgb,var(--cs-heat-ink) 65%,transparent)}
.cs-heatCell[data-level="4"]{background:color-mix(in srgb,var(--cs-heat-ink) 100%,transparent)}
.cs-usageFoot{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
/* Section switch, copied from dsh-claude-style's page-in/page-out pair: an 8px
   horizontal shift carrying a 3px blur, .25s in and .12s out on
   cubic-bezier(.22,1,.36,1). The direction lives in --cs-page-shift, so the
   enter and leave rules share one keyframe each.
     forward: old page leaves to -8px while the new one enters from +8px
     back:    the mirror image */
.cs-page{position:relative}
/* The tab body is the flex column that actually spaces the cards: the section's
   own gap only reaches ITS children, and the body sits between them. */
.cs-pageBody{display:flex;flex-direction:column;gap:16px}
.cs-pageBody[data-enter="forward"],.cs-pageBody[data-leave="back"]{--cs-page-shift:8px}
.cs-pageBody[data-enter="back"],.cs-pageBody[data-leave="forward"]{--cs-page-shift:-8px}
.cs-pageBody[data-enter]{animation:cs-page-in .25s cubic-bezier(.22,1,.36,1)}
.cs-pageBody[data-leave]{position:absolute;inset:0 0 auto;pointer-events:none;animation:cs-page-out .12s cubic-bezier(.22,1,.36,1) forwards}
@keyframes cs-page-in{0%{opacity:0;transform:translate(var(--cs-page-shift));filter:blur(3px)}to{opacity:1;transform:none;filter:blur(0)}}
@keyframes cs-page-out{0%{opacity:1;transform:none;filter:blur(0)}to{opacity:0;transform:translate(var(--cs-page-shift));filter:blur(3px)}}
@media (prefers-reduced-motion:reduce){.cs-pageBody[data-enter],.cs-pageBody[data-leave]{animation:none}}
/* Account table: the gateway panel's account page is a table, and so is this —
   one row per account, columns in the same order (identity, state, credits,
   counters, usage, last success, actions). */
.cs-creditBadge{display:inline-flex;align-items:center;gap:4px;background:none;border:0;padding:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;white-space:nowrap}
.cs-creditBadge b{font-weight:600;color:var(--dsw-alias-label-primary)}
.cs-tableWrap{overflow-x:auto}
.cs-table{width:100%;border-collapse:collapse;font-size:13px}
.cs-table th{text-align:left;font-weight:500;color:var(--dsw-alias-label-tertiary);font-size:12px;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l2);white-space:nowrap}
.cs-table td{padding:9px 8px;border-bottom:.5px solid var(--dsw-alias-border-l2);vertical-align:middle}
.cs-table tr:last-child td{border-bottom:0}
.cs-cellWho{display:flex;flex-direction:column;gap:2px;min-width:120px}
.cs-cellWho .cs-nm{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:500;color:var(--dsw-alias-label-primary);min-width:0}
.cs-cellWho .cs-nm > span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-uid{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums}
.cs-cellState{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:104px}
.cs-note{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:15px}
.cs-cellCred{min-width:110px;font-variant-numeric:tabular-nums}
.cs-cellCred .of{color:var(--dsw-alias-label-tertiary)}
.cs-credBar{height:4px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden;margin-top:5px}
.cs-credBar > i{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary)}
.cs-num{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-label-primary)}
.cs-num .dim{color:var(--dsw-alias-label-tertiary)}
.cs-acts{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;min-width:150px;max-width:210px}
/* Account row, copied from dsh-workbuddy-connect-functy's AccountRow: one line of
   identity (state dot, name, state text, actions) and one line of facts. Not a
   card: the pool is a list, and a list of cards cannot be scanned. */
.cs-accountRow{display:flex;flex-direction:column;gap:2px;min-width:0;padding:10px 2px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.cs-accountRow:last-child{border-bottom:0}
.cs-accountHead{align-items:center;gap:8px;display:flex;min-width:0;min-height:22px}
.cs-accountName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
.cs-accountMeta{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.cs-accountActions{display:flex;flex:none;gap:6px;align-items:center}
/* dialog extras: a full-width cancel, a centred hint, the add row, and the
   emphasised open-in-browser button the international realm gets. */
.cs-titleRow{display:flex;align-items:center;gap:8px}
/* the settings row's glyph, painted over the host's placeholder gear */
[data-wb2a-nav]{position:relative}
[data-wb2a-nav] > svg{display:none}
[data-wb2a-nav]::before{content:"";flex:none;width:16px;height:16px;background-color:currentColor;-webkit-mask-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><g fill='none' stroke='black' stroke-width='58' stroke-linecap='round'><path d='M256 238v38'/><path d='M256 276c0 44-42 64-78 86'/><path d='M256 276c0 44 42 64 78 86'/></g><circle cx='256' cy='178' r='82' fill='black'/><circle cx='144' cy='390' r='68' fill='black'/><circle cx='368' cy='390' r='68' fill='black'/></svg>");mask-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><g fill='none' stroke='black' stroke-width='58' stroke-linecap='round'><path d='M256 238v38'/><path d='M256 276c0 44-42 64-78 86'/><path d='M256 276c0 44 42 64 78 86'/></g><circle cx='256' cy='178' r='82' fill='black'/><circle cx='144' cy='390' r='68' fill='black'/><circle cx='368' cy='390' r='68' fill='black'/></svg>");-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}
display:flex;align-items:center;gap:8px}
.cs-glyph{flex:none;color:var(--dsw-alias-label-secondary)}
.cs-addRow{display:flex;padding-top:10px}
.cs-dialogFull{display:flex;width:100%}
.cs-dialogFull > button{flex:1;width:100%}
.cs-center{text-align:center}
.cs-openButton,.cs-openButton:link,.cs-openButton:visited,.cs-openButton:hover{display:flex;align-items:center;justify-content:center;height:36px;border-radius:9px;background:var(--dsw-alias-brand-primary);color:#ffffff!important;-webkit-text-fill-color:#ffffff;text-decoration:none;font-size:14px;font-weight:500}
.cs-openButton:hover{filter:brightness(1.06)}
.cs-cardActions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:2px}
.cs-page .wb2-group{background:var(--dsw-alias-bg-layer-2);border:0;border-radius:12px;padding:10px 14px;margin-top:0}
.cs-page .wb2-group .wb2-row{border-bottom-color:var(--dsw-alias-border-l2)}
.cs-page .wb2-card{background:var(--dsw-alias-bg-layer-2);border:0;border-radius:12px}
.wb2-mono{font-family:var(--dsw-alias-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;color:var(--dsw-alias-label-secondary);word-break:break-all}
@media (prefers-reduced-motion:reduce){.wb2-toggle::after,.wb2-segmentIndicator,.wb2-segment{transition:none}}
`;
		/** The panel stylesheet. */
		const PANEL_CSS = `
/* ------------------------------------------------- sidebar footer card */
/* The shell's foot area renders this list ABOVE the Settings seat, so the card
   is the sidebar's bottom-most content. The shell supplies no chrome: the entry
   is the button. It is deliberately quiet — a surface that sits beside Settings
   should read as part of the column, not as a call to action — with one hover
   step and a hairline border.

   The shell's container is a flex ROW whose occupants each declare a full-width
   line, so as a row it would overflow the column: this card cannot shrink and a
   sibling sized 100% would absorb the whole overflow. Both were written for a
   full-width line, which is what a column gives them. Matched by the CSS-module
   class STEM — never a hashed name — so a renamed shell degrades to its own row
   rather than breaking, and anchored under "footArea" rather than the bare
   "footerActions" stem because that stem is NOT the shell's alone:
   dsh-client-ui-user-questions renders the ask-user-question dialog's button
   row with it, and the unanchored rule stacked that dialog's side-by-side
   buttons on every page. The descendant combinator (rather than a child one)
   deliberately survives a wrapper element appearing between the two. */
[class*="_footArea"] [class*="_footerActions"]{flex-direction:column}
.wb2-foot{box-sizing:border-box;flex:0 0 auto;width:100%;min-width:0;font:inherit;color:var(--dsw-alias-label-secondary);text-align:left;cursor:pointer;background:0 0;border:1px solid transparent;border-radius:10px;flex-direction:column;gap:6px;margin:0 0 4px;padding:8px;display:flex}
.wb2-foot:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}
.wb2-foot:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.wb2-footTop{align-items:center;gap:8px;min-width:0;display:flex}
.wb2-footName{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;font-size:13px;font-weight:500;line-height:20px}
/* ONE line per product: the label names the figure, the figure sits flush right.
 * nowrap on both halves is load-bearing — the label carries the product name and
 * "剩余额度", and a wrap would put the number on a line of its own, which is
 * exactly the stacked layout this replaced. */
.wb2-footRow{align-items:baseline;gap:8px;min-width:0;display:flex}
/* The "used / total + bar" style stacks its head line over a full-width bar; the
 * default style is the single line above. Two shapes rather than two skins of one
 * markup, because the bar must span the card, not the space left beside a figure. */
.wb2-footRowUsage{flex-direction:column;gap:4px;align-items:stretch}
.wb2-footHead{align-items:baseline;gap:8px;min-width:0;display:flex}
.wb2-footLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.wb2-footAmount{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
.wb2-footBar{display:block;width:100%;background:var(--dsw-alias-bg-layer-2);border-radius:999px;height:5px;overflow:hidden}
.wb2-footFill{display:block;background:var(--dsw-alias-brand-primary);border-radius:999px;height:100%;transition:width .3s ease}
/* ------------------------------------------------------- composer badge */
/* The credit figure in the composer dock, to the RIGHT of the harness's own
 * context readout.
 *
 * Two CSS facts make that placement work, and both are needed:
 *
 * - The dock renders the slot's entries FIRST and appends its own context meter
 *   after them, and the slot outlet uses display:contents, so this element is a
 *   direct flex item of the dock. DOM order alone would therefore put the badge
 *   LEFT of the meter; the flex order below is what moves it after.
 * - The dock centres its items, so being last is not the same as being at the
 *   edge. margin-left:auto absorbs the free space on the badge's left only, which
 *   pins it to the row's right end with the meter beside it.
 *
 * The trigger copies the context meter's (.JObwrW_trigger) metrics: same radius
 * token, same secondary text size, same 1px/8px padding and 6px gap, and the same
 * hover/[aria-expanded] fill — the two sit side by side in one row, so any drift
 * between them reads as one of the two being broken. */
.wb2-creditBadgeRoot{flex:none;display:inline-flex;align-items:center;order:1;margin-left:auto;position:relative}
.wb2-creditBadge{border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-variant-numeric:tabular-nums;line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));white-space:nowrap;cursor:pointer;background:0 0;border:none;flex:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}
.wb2-creditBadge:hover,.wb2-creditBadge[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.wb2-creditBadge:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.wb2-creditBadgeName{color:inherit}
.wb2-creditBadgeValue{color:var(--dsw-alias-label-secondary)}
.wb2-creditBadge[aria-expanded=true] .wb2-creditBadgeValue{color:var(--dsw-alias-label-primary)}
/* The expanded panel: the context popover's own material (.JObwrW_panel) —
 * the menu surface plus its backdrop filter, the prominent elevation token, the
 * same 12px/-lg radius, the same min(264px, …) width, and the same 12px padding
 * and 12px type. Fixed-positioned from the trigger (and portalled) so it survives
 * scrolling and the composer's own overflow. */
.wb2-badgePanel{position:fixed;z-index:1100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);width:min(264px,100vw - 24px);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;padding:12px;font-size:12px;line-height:20px}
/* One product's block, with the pool's own line above its accounts. Separated by
 * a margin rather than a rule: the context popover's two sections are set apart
 * the same way, and a hairline here would draw a card the row above does not. */
.wb2-badgeGroup+.wb2-badgeGroup{margin-top:12px}
.wb2-badgeGroupHead{display:flex;align-items:center;gap:6px}
.wb2-badgeGroupName{color:var(--dsw-alias-label-tertiary)}
.wb2-badgeGroupTotal{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin-left:auto;font-weight:500}
.wb2-badgeBar{corner-shape:round;background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;height:4px;margin:10px 0 12px;display:flex;overflow:hidden}
.wb2-badgeBarFill{background:var(--dsw-alias-brand-primary);border-radius:1px;min-width:2px;height:100%;display:block}
.wb2-badgeRows{margin:6px 0 0}
.wb2-badgeRow{justify-content:space-between;align-items:center;gap:12px;padding:2px 0;display:flex}
.wb2-badgeRow dt{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wb2-badgeRow dd{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin:0;white-space:nowrap}
/* The expanded panel: the context popover's own material (.JObwrW_panel) —
 * the menu surface plus its backdrop filter, the prominent elevation token, the
 * same 12px/-lg radius, the same min(264px, …) width, and the same 12px padding
 * and 12px type. Fixed-positioned from the trigger (and portalled) so it survives
 * scrolling and the composer's own overflow. */
/* One product's block, with the pool's own line above its accounts. Separated by
 * a margin rather than a rule: the context popover's two sections are set apart
 * the same way, and a hairline here would draw a card the row above does not. */
/* -------------------------------------------------------- the rail icon */
.wb2-railButton{box-sizing:border-box;width:36px;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:1px solid transparent;border-radius:8px;flex:none;justify-content:center;align-items:center;margin:0 0 4px;padding:0;display:inline-flex}
.wb2-railButton:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.wb2-railButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
/* The quota ring: one glyph serves the rail button, the card's head and the
   dashboard header. Circumference 2πr = 45.55 at r = 7.25. */
.wb2-glyph{flex:none;justify-content:center;align-items:center;display:inline-flex;color:var(--dsw-alias-brand-primary)}
/* ----------------------------------------------------------- dashboard */
.wb2-main{background:var(--dsw-alias-bg-layer-1);width:100%;height:100%;overflow:auto;display:block}
.wb2-mainInner{max-width:760px;margin:0 auto;padding:24px 20px 40px;flex-direction:column;gap:14px;display:flex;color:var(--dsw-alias-label-primary)}
.wb2-header{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.wb2-headerText{flex-direction:column;gap:2px;display:flex;min-width:0}
.wb2-titleLg{margin:0;font-size:18px;font-weight:600;line-height:1.4}
.wb2-subtitle{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.wb2-notice{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:12px 14px;flex-direction:column;gap:4px;display:flex}
.wb2-noticeError{border-color:var(--dsw-alias-state-error-primary)}
.wb2-noticeTitle{margin:0;font-size:13px;font-weight:600;line-height:1.5}
.wb2-noticeError .wb2-noticeTitle{color:var(--dsw-alias-state-error-primary)}
.wb2-noticeHint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}
/* One product's card: the account head, its quota windows, its totals. */
.wb2-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:14px;padding:16px 18px;flex-direction:column;gap:16px;display:flex}
.wb2-cardHead{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.wb2-avatar{flex:none;width:28px;height:28px;color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform);border-radius:50%;justify-content:center;align-items:center;font-size:12px;font-weight:600;line-height:1;display:inline-flex}
.wb2-cardIdentity{flex-direction:column;gap:1px;min-width:0;display:flex}
.wb2-cardTitle{font-size:13px;font-weight:600;line-height:1.4}
.wb2-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
/* One account's bench: a labelled bar over its remaining wait. */
@media (prefers-reduced-motion:reduce){.wb2-barFill,.wb2-footFill{transition:none}}
`;
		//#endregion
		//#region src/client/index.tsx
		/** Stable browser-plugin name: the package name plus the `-client` half. */
		const name = "dsh-workbuddy-panel-client";
		/**
		* Client services required by this browser half.
		*
		* `modelDirectories` is reached through a scoped `ctx.inject` in the composer
		* credit badge — it may arrive after this fiber starts, and only that seat needs
		* the session's selected route. The other seat owners are not named here either:
		* the slots this bundle registers into belong to different packages, and the
		* seam each host ships is discovered by slot-declaration lifetime rather than by
		* activation order.
		*/
		const inject = [
			"slots",
			"locale",
			"remote"
		];
		/** Nothing to undo. */
		const NOOP_DISPOSER = () => {};
		/** Settings copy namespace. */
		const SETTINGS_NS = "settings.workbuddy2api.gateway";
		/** Dashboard copy namespace. */
		const PANEL_NS = "panel.workbuddy2api.gateway";
		/** Settings page id, and the key the provider card is dispatched with. */
		const SETTINGS_SECTION_ID = "dsh-workbuddy2api-gateway";
		/** Route id this plugin declares on the host; the Models page keys the card by it. */
		const PROVIDER_SETTINGS_NS = "llm-workbuddy2api-gateway";
		/** The dashboard's `main` key: one string shared by the card and the panel cell. */
		const PANEL_ID = "workbuddy2api-gateway-panel";
		/** Reserved `main` key of the conversation, used only as the exit fallback. */
		const CONVERSATION_PANEL_ID = "conversation";
		/**
		* The locale service, typed by the two calls this bundle makes.
		*
		* Reached through `ctx.get` rather than a property: the service table is
		* augmented by the host packages this bundle deliberately does not import, so a
		* property read would not typecheck against a bare Cordis context.
		*/
		function localeOf(ctx) {
			return ctx.get("locale");
		}
		/** The slot registry, typed by the two calls this bundle makes. */
		function slotsOf(ctx) {
			return ctx.get("slots");
		}
		/** Run one contribution, degrading a throw to a console error. */
		function guard(label, run) {
			try {
				return run();
			} catch (error) {
				console.error("[dsh-workbuddy2api-connect] client contribution failed (host route unaffected): " + label, error);
				return;
			}
		}
		/** Inject one stylesheet once; returns its disposer. */
		function injectCss(id, css) {
			if (typeof document === "undefined") return NOOP_DISPOSER;
			if (document.querySelector("style[data-plugin-css=\"" + id + "\"]") !== null) return NOOP_DISPOSER;
			const tag = document.createElement("style");
			tag.dataset["plugin"] = "dsh-workbuddy2api-gateway";
			tag.dataset["pluginCss"] = id;
			tag.textContent = css;
			document.head.appendChild(tag);
			return () => {
				tag.remove();
			};
		}
		/** Wire the browser half. */
		function apply(ctx) {
			try {
				fetch("/plugins/workbuddy2api-gateway/client-hello", { headers: { Accept: "application/json" } }).catch(NOOP_DISPOSER);
			} catch {}
			const locale = localeOf(ctx);
			const slots = slotsOf(ctx);
			guard("settings copy", () => {
				ctx.effect(() => locale.register(SETTINGS_NS, COPY), "dsh-workbuddy2api-connect: settings copy");
			});
			guard("panel copy", () => {
				ctx.effect(() => locale.register(PANEL_NS, COPY), "dsh-workbuddy2api-connect: panel copy");
			});
			const t = makeTranslator(locale.bind(SETTINGS_NS));
			const panelT = makeTranslator(locale.bind(PANEL_NS));
			guard("styles", () => {
				ctx.effect(() => {
					const page = injectCss(PAGE_CSS_ID, PAGE_CSS);
					const dashboard = injectCss(PANEL_CSS_ID, PANEL_CSS);
					return () => {
						page();
						dashboard();
					};
				}, "dsh-workbuddy2api-connect: styles");
			});
			/** The face both dashboard slots carry; `layout` is read at click time. */
			const panelFace = () => ({
				t: panelT,
				store: panelStore,
				open: () => {
					const layout = ctx.get("layout");
					if (typeof layout?.selectPanel === "function") layout.selectPanel(PANEL_ID);
				},
				close: () => {
					const layout = ctx.get("layout");
					if (typeof layout?.selectPanel !== "function") return;
					try {
						layout.selectPanel(null);
					} catch {
						try {
							layout.selectPanel(CONVERSATION_PANEL_ID);
						} catch (error) {
							console.error("[dsh-workbuddy2api-connect] could not close the dashboard", error);
						}
					}
				}
			});
			guard("dashboard panel", () => {
				slots.inject("main", () => guard("dashboard panel", () => slots.register({
					name: "main",
					key: "workbuddy2api-gateway-panel",
					locale: PANEL_NS,
					inject: panelFace
				}, WorkBuddy2ApiPanel)) ?? NOOP_DISPOSER);
			});
			guard("composer credits", () => {
				ctx.inject(["modelDirectories"], (scope) => {
					const modelDirectories = scope.modelDirectories;
					guard("composer credits", () => {
						slots.inject("conversation.composer.dock", () => guard("composer credits", () => slots.register({
							name: "conversation.composer.dock",
							id: "workbuddy2api-credits",
							order: 100,
							inject: (sessionId) => ({
								t: panelT,
								store: panelStore,
								directory: modelDirectories.directoryFor(sessionId).store
							})
						}, WorkBuddy2ApiCreditBadge)) ?? NOOP_DISPOSER);
					});
				});
			});
			guard("nav glyph", () => {
				ctx.effect(() => {
					if (typeof document === "undefined") return () => {};
					const label = t("nav");
					const mark = () => {
						for (const button of document.querySelectorAll("button")) {
							if (button.getAttribute("data-wb2a-nav") !== null) continue;
							const span = button.querySelector("span");
							if (span === null || span.textContent !== label) continue;
							button.setAttribute("data-wb2a-nav", "");
						}
					};
					mark();
					const observer = new MutationObserver(mark);
					observer.observe(document.body, {
						childList: true,
						subtree: true
					});
					return () => {
						observer.disconnect();
					};
				}, "dsh-workbuddy2api-gateway: nav glyph");
			});
			guard("settings section", () => {
				slots.inject("settings.section", () => guard("settings section", () => slots.register({
					name: "settings.section",
					id: SETTINGS_SECTION_ID,
					order: 55,
					label: () => t("nav"),
					locale: SETTINGS_NS,
					inject: () => ({
						t,
						store: panelStore
					})
				}, WorkBuddy2ApiSettingsPage)) ?? NOOP_DISPOSER);
			});
			guard("provider card", () => {
				slots.inject("settings.models.provider-card", () => guard("provider card", () => slots.register({
					name: "settings.models.provider-card",
					key: PROVIDER_SETTINGS_NS,
					locale: SETTINGS_NS,
					inject: () => ({
						t,
						store: panelStore
					})
				}, WorkBuddy2ApiProviderCard)) ?? NOOP_DISPOSER);
			});
		}
		/**
		* The Models-page row's card: what the route is and where its models come from.
		*
		* The page's own editor has no fields for a provider whose catalog is served by
		* a gateway, so this card is the whole offer — a sentence, the route id, and the
		* live model count, with the real controls living on the plugin's own page.
		*/
		function WorkBuddy2ApiProviderCard(props) {
			const { t, store } = props;
			const snapshot = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
			(0, react.useEffect)(() => {
				store.start();
				return () => {
					store.stop();
				};
			}, [store]);
			const document = snapshot.document;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wb2-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wb2-cardHead",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wb2-cardTitle",
							children: t("title")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "wb2-spacer" }),
						document === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Badge, {
							tone: "muted",
							children: t("overviewModelsValue", document.counts.enabledModels, document.counts.models)
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "wb2-noticeHint",
					children: t("intro")
				})]
			});
		}
		//#endregion
		exports.PANEL_ID = PANEL_ID;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
