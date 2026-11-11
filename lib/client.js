/**
 * dsh-dr-panda-mcp — browser half.
 *
 * Connection form on the plugin detail page (plugins.bundle.config) and a
 * matching Settings → DrPanda MCP section. Talks to host routes only; never
 * imports @deepseek-ai/* (those live inside app.asar).
 */
window.__ModuleLoader__.load({
  id: "dsh-dr-panda-mcp",
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    var PACKAGE_ID = "dsh-dr-panda-mcp";
    var SETTINGS_PATH = "/dsh-dr-panda-mcp/settings";
    var PROBE_PATH = "/dsh-dr-panda-mcp/probe";
    var SETTINGS_SLOT = "settings.section";
    var SETTINGS_ENTRY_ID = "drpanda-mcp-settings";
    var SETTINGS_ORDER = 64;
    var SETTINGS_NAV_ICON_SLOT = "settings.section.icon";
    var STYLE_ID = PACKAGE_ID + "-styles";
    var inject = ["slots"];

    function apiUrl(path) {
      var relative = String(path).replace(/^\/+/, "");
      try {
        if (typeof document === "undefined") return "/" + relative;
        return new URL(relative, document.baseURI).pathname;
      } catch (error) {
        return "/" + relative;
      }
    }

    function isZh() {
      try {
        var lang = String(
          (typeof navigator !== "undefined" && (navigator.language || navigator.userLanguage)) || "en",
        ).toLowerCase();
        return lang.indexOf("zh") === 0;
      } catch (error) {
        return false;
      }
    }

    function copy() {
      if (isZh()) {
        return {
          nav: "DrPanda MCP",
          title: "连接 DrPanda",
          blurb: "填写已部署的 DrPanda MCP 地址与 Bearer Token。Token 保存在 DSH credentials（DR_PANDA_MCP_TOKEN），不会写进 patch。",
          url: "MCP URL",
          token: "Bearer Token",
          tokenHint: "留空则保留已保存的 Token；勾选清除可删除。",
          serverName: "serverName（高级）",
          timeout: "toolCallTimeoutMs（高级）",
          save: "保存",
          saving: "保存中…",
          saved: "已保存",
          test: "测试连接",
          testing: "测试中…",
          clearToken: "清除已保存 Token",
          tokenSet: "已配置",
          tokenMissing: "未配置",
          advanced: "高级选项",
          loadError: "无法加载设置",
          fromEnv: "当前可用环境变量中的 Token",
        };
      }
      return {
        nav: "DrPanda MCP",
        title: "Connect DrPanda",
        blurb: "Enter your running DrPanda MCP URL and Bearer token. The token is stored in DSH credentials (DR_PANDA_MCP_TOKEN), not in the patch file.",
        url: "MCP URL",
        token: "Bearer Token",
        tokenHint: "Leave blank to keep the stored token; check clear to remove it.",
        serverName: "serverName (advanced)",
        timeout: "toolCallTimeoutMs (advanced)",
        save: "Save",
        saving: "Saving…",
        saved: "Saved",
        test: "Test connection",
        testing: "Testing…",
        clearToken: "Clear stored token",
        tokenSet: "Configured",
        tokenMissing: "Not set",
        advanced: "Advanced",
        loadError: "Failed to load settings",
        fromEnv: "Token available from environment",
      };
    }

    var CSS = [
      ".dpm-panel{display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:1.5;",
      "color:var(--dsw-alias-label-primary);max-width:560px}",
      ".dpm-title{font-weight:600;font-size:14px}",
      ".dpm-blurb{color:var(--dsw-alias-label-secondary);margin:0}",
      ".dpm-field{display:flex;flex-direction:column;gap:4px}",
      ".dpm-field label{font-weight:500}",
      ".dpm-field input[type=text],.dpm-field input[type=password],.dpm-field input[type=number]{",
      "height:32px;padding:0 10px;border-radius:var(--dsw-radius-sm);",
      "border:1px solid var(--dsw-alias-border-primary);background:var(--dsw-alias-bg-primary);",
      "color:inherit;font:inherit}",
      ".dpm-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
      ".dpm-btn{height:32px;padding:0 12px;border:none;border-radius:var(--dsw-radius-sm);",
      "background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-on-primary, #fff);",
      "font:inherit;font-weight:500;cursor:pointer}",
      ".dpm-btn[disabled]{opacity:.55;cursor:not-allowed}",
      ".dpm-btn--ghost{background:transparent;color:var(--dsw-alias-label-primary);",
      "border:1px solid var(--dsw-alias-border-primary)}",
      ".dpm-status{min-height:1.2em;color:var(--dsw-alias-label-secondary)}",
      ".dpm-status[data-tone=ok]{color:var(--dsw-alias-state-success-primary)}",
      ".dpm-status[data-tone=warn]{color:var(--dsw-alias-state-warn-primary)}",
      ".dpm-status[data-tone=err]{color:var(--dsw-alias-state-danger-primary)}",
      ".dpm-badge{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;",
      "border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);font-size:12px}",
      ".dpm-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px}",
      ".dpm-advanced{border:none;padding:0;margin:0}",
      ".dpm-advanced summary{cursor:pointer;color:var(--dsw-alias-label-secondary)}",
    ].join("");

    function installStyles() {
      try {
        if (typeof document === "undefined") return;
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
      } catch (error) {
        /* ignore */
      }
    }

    function useConnection() {
      var viewPair = React.useState({ phase: "loading", data: null, error: null });
      var view = viewPair[0];
      var setView = viewPair[1];
      var draftPair = React.useState(null);
      var draft = draftPair[0];
      var setDraft = draftPair[1];
      var savePair = React.useState({ phase: "idle", message: "", tone: "" });
      var saveState = savePair[0];
      var setSaveState = savePair[1];
      var probePair = React.useState({ phase: "idle", message: "", tone: "" });
      var probeState = probePair[0];
      var setProbeState = probePair[1];

      var load = React.useCallback(function () {
        return fetch(apiUrl(SETTINGS_PATH), { headers: { accept: "application/json" }, cache: "no-store" })
          .then(function (response) {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
          })
          .then(function (body) {
            setView({ phase: "ready", data: body, error: null });
            setDraft({
              mcpUrl: body.settings && body.settings.mcpUrl ? body.settings.mcpUrl : "",
              serverName: body.settings && body.settings.serverName ? body.settings.serverName : "drpanda",
              toolCallTimeoutMs:
                body.settings && body.settings.toolCallTimeoutMs ? body.settings.toolCallTimeoutMs : 120000,
              token: "",
              clearToken: false,
            });
            return body;
          })
          .catch(function (error) {
            setView({
              phase: "error",
              data: null,
              error: String(error && error.message ? error.message : error),
            });
          });
      }, []);

      React.useEffect(
        function () {
          load();
        },
        [load],
      );

      var save = React.useCallback(
        function () {
          if (!draft) return Promise.resolve(null);
          setSaveState({ phase: "saving", message: copy().saving, tone: "" });
          var payload = {
            settings: {
              mcpUrl: draft.mcpUrl,
              serverName: draft.serverName,
              toolCallTimeoutMs: Number(draft.toolCallTimeoutMs),
            },
            clearToken: draft.clearToken === true,
          };
          if (draft.token && String(draft.token).trim()) payload.token = String(draft.token).trim();
          return fetch(apiUrl(SETTINGS_PATH), {
            method: "POST",
            headers: { accept: "application/json", "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
            .then(function (response) {
              return response.json().then(function (body) {
                return { response: response, body: body };
              });
            })
            .then(function (result) {
              if (!result.response.ok) {
                setSaveState({
                  phase: "error",
                  message: (result.body && result.body.error) || "HTTP " + result.response.status,
                  tone: "err",
                });
                return result.body;
              }
              setView({ phase: "ready", data: result.body, error: null });
              setDraft(function (prev) {
                if (!prev) return prev;
                return Object.assign({}, prev, { token: "", clearToken: false });
              });
              var reload = result.body && result.body.write && result.body.write.reload;
              var extra =
                reload && reload.restartRequired
                  ? isZh()
                    ? "（serverName/超时若未生效请重启 DSH）"
                    : " (restart DSH if serverName/timeout did not apply)"
                  : "";
              setSaveState({ phase: "saved", message: copy().saved + extra, tone: "ok" });
              return result.body;
            })
            .catch(function (error) {
              setSaveState({
                phase: "error",
                message: String(error && error.message ? error.message : error),
                tone: "err",
              });
              return null;
            });
        },
        [draft],
      );

      var probe = React.useCallback(
        function () {
          if (!draft) return Promise.resolve(null);
          setProbeState({ phase: "testing", message: copy().testing, tone: "" });
          return fetch(apiUrl(PROBE_PATH), {
            method: "POST",
            headers: { accept: "application/json", "content-type": "application/json" },
            body: JSON.stringify({
              url: draft.mcpUrl,
              token: draft.token && String(draft.token).trim() ? String(draft.token).trim() : undefined,
            }),
          })
            .then(function (response) {
              return response.json();
            })
            .then(function (body) {
              var tone = body && body.ok ? "ok" : "err";
              var message =
                (body && body.mcp && body.mcp.detail) ||
                (body && body.state) ||
                (body && body.error) ||
                "done";
              setProbeState({ phase: "done", message: String(body.state || "") + ": " + message, tone: tone });
              return body;
            })
            .catch(function (error) {
              setProbeState({
                phase: "error",
                message: String(error && error.message ? error.message : error),
                tone: "err",
              });
              return null;
            });
        },
        [draft],
      );

      return {
        view: view,
        draft: draft,
        setDraft: setDraft,
        saveState: saveState,
        probeState: probeState,
        save: save,
        probe: probe,
        reload: load,
      };
    }

    function ConnectionForm() {
      var t = copy();
      var host = useConnection();
      var view = host.view;
      var draft = host.draft;

      if (view.phase === "loading" || !draft) {
        return React.createElement("div", { className: "dpm-panel" }, "…");
      }
      if (view.phase === "error") {
        return React.createElement(
          "div",
          { className: "dpm-panel" },
          React.createElement("div", { className: "dpm-status", "data-tone": "err" }, t.loadError + ": " + view.error),
        );
      }

      var tokenMeta = view.data && view.data.credentials && view.data.credentials.token;
      var tokenLabel = tokenMeta && tokenMeta.configured
        ? t.tokenSet
        : tokenMeta && tokenMeta.source === "env"
          ? t.fromEnv
          : t.tokenMissing;

      function patch(field, value) {
        host.setDraft(function (prev) {
          var next = Object.assign({}, prev);
          next[field] = value;
          return next;
        });
      }

      return React.createElement(
        "div",
        { className: "dpm-panel" },
        React.createElement("div", { className: "dpm-title" }, t.title),
        React.createElement("p", { className: "dpm-blurb" }, t.blurb),
        React.createElement(
          "div",
          { className: "dpm-row" },
          React.createElement("span", { className: "dpm-badge" }, "Token: " + tokenLabel),
        ),
        React.createElement(
          "div",
          { className: "dpm-field" },
          React.createElement("label", null, t.url),
          React.createElement("input", {
            type: "text",
            value: draft.mcpUrl,
            onChange: function (event) {
              patch("mcpUrl", event.target.value);
            },
            spellCheck: false,
            autoComplete: "off",
          }),
        ),
        React.createElement(
          "div",
          { className: "dpm-field" },
          React.createElement("label", null, t.token),
          React.createElement("input", {
            type: "password",
            value: draft.token,
            placeholder: tokenMeta && tokenMeta.configured ? "••••••••" : "",
            onChange: function (event) {
              patch("token", event.target.value);
            },
            autoComplete: "off",
          }),
          React.createElement("p", { className: "dpm-hint" }, t.tokenHint),
          React.createElement(
            "label",
            { className: "dpm-row" },
            React.createElement("input", {
              type: "checkbox",
              checked: draft.clearToken === true,
              onChange: function (event) {
                patch("clearToken", event.target.checked);
              },
            }),
            t.clearToken,
          ),
        ),
        React.createElement(
          "details",
          { className: "dpm-advanced" },
          React.createElement("summary", null, t.advanced),
          React.createElement(
            "div",
            { className: "dpm-field", style: { marginTop: 8 } },
            React.createElement("label", null, t.serverName),
            React.createElement("input", {
              type: "text",
              value: draft.serverName,
              onChange: function (event) {
                patch("serverName", event.target.value);
              },
            }),
          ),
          React.createElement(
            "div",
            { className: "dpm-field" },
            React.createElement("label", null, t.timeout),
            React.createElement("input", {
              type: "number",
              value: draft.toolCallTimeoutMs,
              onChange: function (event) {
                patch("toolCallTimeoutMs", event.target.value);
              },
            }),
          ),
        ),
        React.createElement(
          "div",
          { className: "dpm-row" },
          React.createElement(
            "button",
            {
              type: "button",
              className: "dpm-btn",
              disabled: host.saveState.phase === "saving",
              onClick: function () {
                host.save();
              },
            },
            host.saveState.phase === "saving" ? t.saving : t.save,
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "dpm-btn dpm-btn--ghost",
              disabled: host.probeState.phase === "testing",
              onClick: function () {
                host.probe();
              },
            },
            host.probeState.phase === "testing" ? t.testing : t.test,
          ),
        ),
        React.createElement(
          "div",
          { className: "dpm-status", "data-tone": host.saveState.tone || undefined },
          host.saveState.message || "",
        ),
        React.createElement(
          "div",
          { className: "dpm-status", "data-tone": host.probeState.tone || undefined },
          host.probeState.message || "",
        ),
      );
    }

    function registerBundleSlots(ctx) {
      var entries = [
        ["plugins.bundle.config", ConnectionForm],
      ];
      for (var index = 0; index < entries.length; index += 1) {
        var name = entries[index][0];
        var Component = entries[index][1];
        try {
          ctx.slots.inject(name, function (slotName, SlotComponent) {
            return function () {
              return ctx.slots.register(
                {
                  name: slotName,
                  key: PACKAGE_ID,
                  label: function () {
                    return copy().title;
                  },
                },
                SlotComponent,
              );
            };
          }(name, Component));
        } catch (error) {
          try {
            console.error("[" + PACKAGE_ID + "] " + name + " registration failed:", error);
          } catch (ignored) {
            /* ignore */
          }
        }
      }
    }

    function SettingsNavIcon(props) {
      var size = props && typeof props.size === "number" ? props.size : 16;
      return React.createElement(
        "svg",
        {
          xmlns: "http://www.w3.org/2000/svg",
          viewBox: "0 0 16 16",
          width: size,
          height: size,
          fill: "currentColor",
          "aria-hidden": "true",
          focusable: "false",
        },
        React.createElement("path", {
          d: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 2.2a.75.75 0 0 1 .75.75v3.1l2.1 1.25a.75.75 0 1 1-.75 1.3L7.6 8.55A.75.75 0 0 1 7.25 7.9V4.45A.75.75 0 0 1 8 3.7Z",
        }),
      );
    }

    function registerSettingsNavIcon(ctx) {
      try {
        ctx.slots.inject(SETTINGS_NAV_ICON_SLOT, function () {
          return ctx.slots.register(
            {
              name: SETTINGS_NAV_ICON_SLOT,
              id: SETTINGS_ENTRY_ID,
              order: SETTINGS_ORDER,
              label: function () {
                return copy().nav;
              },
            },
            SettingsNavIcon,
          );
        });
      } catch (error) {
        /* ignore */
      }
    }

    function registerSettingsSection(ctx) {
      try {
        ctx.slots.inject(SETTINGS_SLOT, function () {
          return ctx.slots.register(
            {
              name: SETTINGS_SLOT,
              id: SETTINGS_ENTRY_ID,
              order: SETTINGS_ORDER,
              label: function () {
                return copy().nav;
              },
            },
            function SettingsSection() {
              return React.createElement(ConnectionForm, null);
            },
          );
        });
      } catch (error) {
        /* ignore */
      }
    }

    function apply(ctx) {
      installStyles();
      registerBundleSlots(ctx);
      registerSettingsNavIcon(ctx);
      registerSettingsSection(ctx);
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
