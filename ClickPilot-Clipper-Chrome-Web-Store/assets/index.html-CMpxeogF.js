import { _ as _imports_0 } from "./icon-128x128-vueRucpI.js";
import { r as ref, d as defineComponent, c as computed, a as createElementBlock, o as openBlock, f as createBaseVNode, k as createBlock, g as createVNode, x as createStaticVNode, m as createCommentVNode, i as createTextVNode, t as toDisplayString, w as withCtx, v as createApp } from "./runtime-dom.esm-bundler-Xd0mhF8b.js";
import { B as BaseButton } from "./BaseButton-tkDa9cVX.js";
const user = ref(null);
async function GetUserFromSW() {
  const { data } = await SendMessageToSW("getUser");
  user.value = data;
}
async function SendMessageToSW(type, data) {
  return await chrome.runtime.sendMessage({ type, data });
}
async function Init() {
  await GetUserFromSW();
}
const _hoisted_1 = { class: "p-8 min-w-75 text-center bg-gray-800" };
const _hoisted_2 = { key: 0 };
const _hoisted_3 = { class: "text-gray-200 mb-4" };
const _hoisted_4 = { class: "block text-white mt-1" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "App",
  setup(__props) {
    const user$1 = computed(() => {
      return user.value;
    });
    function openOptions() {
      chrome.runtime.openOptionsPage();
    }
    function login() {
      SendMessageToSW("login");
    }
    async function logout() {
      await SendMessageToSW("logout");
      user.value = null;
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        _cache[7] || (_cache[7] = createBaseVNode("img", {
          src: _imports_0,
          class: "inline-block mb-2 w-16"
        }, null, -1)),
        _cache[8] || (_cache[8] = createBaseVNode("h1", { class: "font-black text-xl mb-4" }, "ClickPilot Clipper", -1)),
        user$1.value ? (openBlock(), createElementBlock("div", _hoisted_2, [
          createBaseVNode("div", _hoisted_3, [
            _cache[3] || (_cache[3] = createTextVNode(" Logged in as: ", -1)),
            createBaseVNode("span", _hoisted_4, toDisplayString(user$1.value.email), 1)
          ]),
          user$1.value ? (openBlock(), createBlock(BaseButton, {
            key: 0,
            block: "",
            onClick: _cache[0] || (_cache[0] = ($event) => logout())
          }, {
            default: withCtx(() => [..._cache[4] || (_cache[4] = [
              createTextVNode("Logout", -1)
            ])]),
            _: 1
          })) : createCommentVNode("", true)
        ])) : (openBlock(), createBlock(BaseButton, {
          key: 1,
          block: "",
          onClick: _cache[1] || (_cache[1] = ($event) => login())
        }, {
          default: withCtx(() => [..._cache[5] || (_cache[5] = [
            createTextVNode("Login", -1)
          ])]),
          _: 1
        })),
        createVNode(BaseButton, {
          type: "gray",
          customClasses: "mt-2",
          block: "",
          onClick: _cache[2] || (_cache[2] = ($event) => openOptions())
        }, {
          default: withCtx(() => [..._cache[6] || (_cache[6] = [
            createTextVNode("Options", -1)
          ])]),
          _: 1
        }),
        _cache[9] || (_cache[9] = createStaticVNode('<a class="inline-flex items-center gap-1 text-xs mt-4 bg-gray-600 text-gray-200 px-2.5 py-1.5 transition-colors rounded-full hover:text-white" href="https://discord.gg/j73qQx5TjE" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" class="w-2.5 fill-current inline-block" viewBox="0 0 384 512"><path d="M272 384c9.6-31.9 29.5-59.1 49.2-86.2l0 0c5.2-7.1 10.4-14.2 15.4-21.4c19.8-28.5 31.4-63 31.4-100.3C368 78.8 289.2 0 192 0S16 78.8 16 176c0 37.3 11.6 71.9 31.4 100.3c5 7.2 10.2 14.3 15.4 21.4l0 0c19.8 27.1 39.7 54.4 49.2 86.2H272zM192 512c44.2 0 80-35.8 80-80V416H112v16c0 44.2 35.8 80 80 80zM112 176c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-61.9 50.1-112 112-112c8.8 0 16 7.2 16 16s-7.2 16-16 16c-44.2 0-80 35.8-80 80z"></path></svg> Ideas or <svg class="w-3 fill-current inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 0c53 0 96 43 96 96v3.6c0 15.7-12.7 28.4-28.4 28.4H188.4c-15.7 0-28.4-12.7-28.4-28.4V96c0-53 43-96 96-96zM41.4 105.4c12.5-12.5 32.8-12.5 45.3 0l64 64c.7 .7 1.3 1.4 1.9 2.1c14.2-7.3 30.4-11.4 47.5-11.4H312c17.1 0 33.2 4.1 47.5 11.4c.6-.7 1.2-1.4 1.9-2.1l64-64c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3l-64 64c-.7 .7-1.4 1.3-2.1 1.9c6.2 12 10.1 25.3 11.1 39.5H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H416c0 24.6-5.5 47.8-15.4 68.6c2.2 1.3 4.2 2.9 6 4.8l64 64c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0l-63.1-63.1c-24.5 21.8-55.8 36.2-90.3 39.6V240c0-8.8-7.2-16-16-16s-16 7.2-16 16V479.2c-34.5-3.4-65.8-17.8-90.3-39.6L86.6 502.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l64-64c1.9-1.9 3.9-3.4 6-4.8C101.5 367.8 96 344.6 96 320H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H96.3c1.1-14.1 5-27.5 11.1-39.5c-.7-.6-1.4-1.2-2.1-1.9l-64-64c-12.5-12.5-12.5-32.8 0-45.3z"></path></svg> Bugs </a>', 1))
      ]);
    };
  }
});
(async () => {
  await Init();
  const appElem = document.createElement("div");
  appElem.id = "click-pilot-clipper-app";
  document.body.appendChild(appElem);
  createApp(_sfc_main).mount(appElem);
})();
