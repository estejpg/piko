import { r as ref, d as defineComponent, c as computed, a as createElementBlock, o as openBlock, b as renderSlot, n as normalizeClass, e as onMounted, f as createBaseVNode, g as createVNode, w as withCtx, h as onUnmounted, i as createTextVNode, t as toDisplayString, F as Fragment, j as renderList, u as unref, k as createBlock, T as TransitionGroup, l as onBeforeUnmount, m as createCommentVNode, p as Transition, q as resolveDirective, s as withDirectives, v as createApp } from "./runtime-dom.esm-bundler-Xd0mhF8b.js";
import { t as twMerge, B as BaseButton, _ as _export_sfc } from "./BaseButton-tkDa9cVX.js";
const settings = ref();
const videos = ref([]);
const user = ref(null);
const selectedProjectID = ref(null);
const toasts = ref([]);
function CreateToast(toast) {
  const id = Date.now().toString() + Math.random().toString();
  toasts.value.push({ ...toast, id });
  return id;
}
function RemoveToast(id) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}
async function GetStateFromStorage() {
  const { data } = await SendMessageToSW("getStorage");
  videos.value = data.videos;
  selectedProjectID.value = data.selectedProjectID;
  settings.value = data.settings;
}
async function GetUserFromSW() {
  const { data } = await SendMessageToSW("getUser");
  user.value = data;
}
async function SaveVideos() {
  var _a, _b;
  if (!selectedProjectID.value) throw new Error("No project selected");
  const { error } = await SendMessageToSW("saveVideos", {
    videos: videos.value,
    projectID: selectedProjectID.value,
    deleteVidsOnSave: (_a = settings.value) == null ? void 0 : _a.deleteVidsOnSave
  });
  if (error) throw new Error(error);
  if ((_b = settings.value) == null ? void 0 : _b.deleteVidsOnSave) {
    videos.value = [];
  }
}
async function AddVideo(video) {
  if (videos.value.some((v) => v.id === video.id)) {
    CreateToast({
      message: "Video already in list",
      type: "error"
    });
    return;
  }
  videos.value = [...videos.value, video];
  await SendMessageToSW("setVideos", videos.value);
}
async function RemoveVideo(id) {
  videos.value = videos.value.filter((video) => video.id !== id);
  await SendMessageToSW("setVideos", videos.value);
}
async function RemoveAllVideos() {
  videos.value = [];
  await SendMessageToSW("setVideos", videos.value);
}
async function SetSelectedProjectID(id) {
  selectedProjectID.value = id;
  await SendMessageToSW("setSelectedProjectID", id);
}
async function SendMessageToSW(type, data) {
  return await chrome.runtime.sendMessage({ type, data });
}
async function Init() {
  await GetStateFromStorage();
  await GetUserFromSW();
}
const _sfc_main$7 = /* @__PURE__ */ defineComponent({
  __name: "BaseCard",
  props: {
    customClasses: {},
    shadowSize: {},
    flatBottomCorners: { type: Boolean }
  },
  setup(__props) {
    const props = __props;
    const classes = computed(() => {
      let defaultClasses = "bg-gray-800 p-4 transition-all";
      if (props.flatBottomCorners) {
        defaultClasses += " rounded-t-2xl";
      } else {
        defaultClasses += " rounded-2xl";
      }
      switch (props.shadowSize) {
        case "sm":
          defaultClasses += " border-double-shadow";
          break;
        case "lg":
          defaultClasses += " border-double-shadow-lg";
          break;
        default:
          defaultClasses += " border-double-shadow";
      }
      return twMerge(defaultClasses, props.customClasses);
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(classes.value)
      }, [
        renderSlot(_ctx.$slots, "default")
      ], 2);
    };
  }
});
const _hoisted_1$5 = { class: "border-stroke rounded-xl transition-all relative group" };
const _hoisted_2$5 = ["src"];
const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "Thumbnail",
  props: {
    videoID: {}
  },
  emits: ["delete", "onMount"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const thumbnailURL = computed(() => {
      return `https://i.ytimg.com/vi/${props.videoID}/mqdefault.jpg`;
    });
    onMounted(() => {
      emit("onMount");
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$5, [
        createBaseVNode("img", {
          class: "rounded-xl aspect-video max-w-28 select-none pointer-events-none",
          src: thumbnailURL.value,
          alt: "thumb",
          width: "114",
          height: "65"
        }, null, 8, _hoisted_2$5),
        createVNode(BaseButton, {
          onClick: _cache[0] || (_cache[0] = ($event) => emit("delete")),
          type: "gray",
          class: "delete-button",
          "custom-classes": "absolute p-1 rounded-full -right-1 -top-1 z-10 w-9 h-9 text-2xl"
        }, {
          default: withCtx(() => [..._cache[1] || (_cache[1] = [
            createBaseVNode("span", { class: "leading-none select-none pointer-events-none" }, "×", -1)
          ])]),
          _: 1
        })
      ]);
    };
  }
});
const Thumbnail = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["__scopeId", "data-v-1244b0ff"]]);
const _hoisted_1$4 = { class: "text-center w-full pointer-events-none" };
const _hoisted_2$4 = { class: "mt-4 inline-flex items-center rounded-xl border-stroke shadow-lg p-4 bg-gray-700 shadow-black pointer-events-auto gap-4 text-xl font-bold" };
const _hoisted_3$2 = {
  key: 0,
  xmlns: "http://www.w3.org/2000/svg",
  height: "1.3em",
  viewBox: "0 0 512 520",
  class: "text-success"
};
const _hoisted_4$1 = {
  key: 1,
  xmlns: "http://www.w3.org/2000/svg",
  height: "1.3em",
  viewBox: "0 0 512 520",
  class: "text-error"
};
const DEFAULT_DURATION = 2e3;
const _sfc_main$5 = /* @__PURE__ */ defineComponent({
  __name: "BaseToast",
  props: {
    toast: {}
  },
  setup(__props) {
    const props = __props;
    let timeout;
    onMounted(() => {
      timeout = setTimeout(() => {
        RemoveToast(props.toast.id);
      }, props.toast.duration || DEFAULT_DURATION);
    });
    onUnmounted(() => {
      clearTimeout(timeout);
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$4, [
        createBaseVNode("div", _hoisted_2$4, [
          __props.toast.type === "success" ? (openBlock(), createElementBlock("svg", _hoisted_3$2, [..._cache[0] || (_cache[0] = [
            createBaseVNode("path", {
              fill: "currentColor",
              d: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"
            }, null, -1)
          ])])) : (openBlock(), createElementBlock("svg", _hoisted_4$1, [..._cache[1] || (_cache[1] = [
            createBaseVNode("path", {
              fill: "currentColor",
              d: "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm97.9-320l-17 17-47 47 47 47 17 17L320 353.9l-17-17-47-47-47 47-17 17L158.1 320l17-17 47-47-47-47-17-17L192 158.1l17 17 47 47 47-47 17-17L353.9 192z"
            }, null, -1)
          ])])),
          createTextVNode(" " + toDisplayString(__props.toast.message), 1)
        ])
      ]);
    };
  }
});
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "ToastProvider",
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", null, [
        createVNode(TransitionGroup, {
          tag: "div",
          name: "list",
          class: "fixed left-0 right-0 toast-container pointer-events-none grid content-end"
        }, {
          default: withCtx(() => [
            (openBlock(true), createElementBlock(Fragment, null, renderList(unref(toasts), (toast) => {
              return openBlock(), createBlock(_sfc_main$5, {
                toast,
                key: toast.id
              }, null, 8, ["toast"]);
            }), 128))
          ]),
          _: 1
        }),
        renderSlot(_ctx.$slots, "default", {}, void 0, true)
      ]);
    };
  }
});
const ToastProvider = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-ac2499ed"]]);
const _hoisted_1$3 = {
  key: 0,
  class: "truncate flex-1"
};
const _hoisted_2$3 = {
  key: 1,
  class: "truncate flex-1"
};
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "SelectedProject",
  props: {
    user: {},
    selected: {}
  },
  emits: ["toggle"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    function toggle(e) {
      e.stopImmediatePropagation();
      emit("toggle");
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("button", {
        onClick: toggle,
        class: "text-lg border-stroke bg-gray-900/50 px-4 py-2 rounded-xl flex items-center gap-2 text-left"
      }, [
        __props.selected ? (openBlock(), createElementBlock("div", _hoisted_1$3, toDisplayString(__props.selected), 1)) : (openBlock(), createElementBlock("span", _hoisted_2$3, "Select A Project")),
        _cache[0] || (_cache[0] = createBaseVNode("svg", {
          class: "relative -top-0.5 text-gray-400",
          width: "9",
          height: "9",
          viewBox: "0 0 10 9",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg"
        }, [
          createBaseVNode("path", {
            d: "M4.15385 7.65655C4.54608 8.2793 5.45392 8.2793 5.84615 7.65655L9.23065 2.28294C9.65007 1.61702 9.17149 0.749999 8.3845 0.749999L1.6155 0.75C0.828508 0.75 0.349928 1.61702 0.769348 2.28294L4.15385 7.65655Z",
            fill: "currentColor"
          })
        ], -1))
      ]);
    };
  }
});
const _hoisted_1$2 = { class: "absolute left-0 bottom-full w-full mb-2 text-lg" };
const _hoisted_2$2 = ["onClick"];
const _hoisted_3$1 = {
  key: 0,
  class: "p-2 text-center"
};
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "ProjectDropdown",
  props: {
    projects: {},
    selectedProjectID: {}
  },
  emits: ["close", "select"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const contRef = ref(null);
    const filteredProjects = computed(() => {
      if (!props.selectedProjectID) return props.projects;
      return props.projects.filter((project) => {
        return project._id !== props.selectedProjectID;
      });
    });
    function select(project) {
      emit("select", project);
      emit("close");
    }
    function detectClickOutside(e) {
      if (!contRef.value) return;
      if (contRef.value === e.target) return;
      if (!contRef.value.contains(e.target)) {
        emit("close");
      }
    }
    onMounted(async () => {
      document.addEventListener("click", detectClickOutside);
    });
    onBeforeUnmount(() => {
      document.removeEventListener("click", detectClickOutside);
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$2, [
        createBaseVNode("div", {
          ref_key: "contRef",
          ref: contRef,
          class: "border-double-shadow rounded-xl rounded-xl bg-gray-800 shadow-xl overflow-hidden p-2 max-w-75 mx-auto"
        }, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(filteredProjects.value, (project) => {
            return openBlock(), createElementBlock("div", {
              onClick: ($event) => select(project),
              class: "p-2 hover:bg-gray-600 cursor-pointer text-left truncate rounded-xl font-bold"
            }, toDisplayString(project.name), 9, _hoisted_2$2);
          }), 256)),
          !filteredProjects.value.length ? (openBlock(), createElementBlock("div", _hoisted_3$1, [..._cache[0] || (_cache[0] = [
            createBaseVNode("div", { class: "text-center mb-1" }, "No More Projects", -1),
            createBaseVNode("div", { class: "text-base opacity-70" }, "Create more on ClickPilot", -1)
          ])])) : createCommentVNode("", true)
        ], 512)
      ]);
    };
  }
});
const ProjectDropdown = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-fb4c5a51"]]);
const _hoisted_1$1 = { class: "p-2 w-140px flex flex-col gap-2 h-full relative" };
const _hoisted_2$1 = {
  href: "https://clickpilot.app",
  target: "_blank"
};
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "UserPanel",
  props: {
    selectedProjectName: {},
    selectedProjectID: {},
    projects: {},
    user: {}
  },
  emits: ["login", "saveVideos", "selectProject"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const projectDropdownOpen = ref(false);
    return (_ctx, _cache) => {
      var _a;
      return openBlock(), createElementBlock("div", _hoisted_1$1, [
        __props.user ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
          __props.user.isPro || ((_a = __props.user.editorBaseProjects) == null ? void 0 : _a.length) ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
            createVNode(Transition, { name: "fade" }, {
              default: withCtx(() => [
                projectDropdownOpen.value ? (openBlock(), createBlock(ProjectDropdown, {
                  key: 0,
                  projects: __props.projects,
                  selectedProjectID: __props.selectedProjectID,
                  onSelect: _cache[0] || (_cache[0] = ($event) => emit("selectProject", $event)),
                  onClose: _cache[1] || (_cache[1] = ($event) => projectDropdownOpen.value = false)
                }, null, 8, ["projects", "selectedProjectID"])) : createCommentVNode("", true)
              ]),
              _: 1
            }),
            createVNode(_sfc_main$3, {
              user: __props.user,
              selected: __props.selectedProjectName,
              onToggle: _cache[2] || (_cache[2] = ($event) => projectDropdownOpen.value = !projectDropdownOpen.value)
            }, null, 8, ["user", "selected"]),
            createVNode(BaseButton, {
              disabled: !__props.selectedProjectName,
              onClick: _cache[3] || (_cache[3] = ($event) => emit("saveVideos")),
              type: "gray",
              block: "",
              "custom-classes": "font-bold text-lg"
            }, {
              default: withCtx(() => [..._cache[5] || (_cache[5] = [
                createTextVNode("Save to Board", -1)
              ])]),
              _: 1
            }, 8, ["disabled"])
          ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
            _cache[7] || (_cache[7] = createBaseVNode("span", { class: "text-lg border-stroke bg-gray-900/50 px-4 py-2 rounded-xl flex-1 flex items-center justify-center opacity-50" }, "You Don't Have Pro", -1)),
            createBaseVNode("a", _hoisted_2$1, [
              createVNode(BaseButton, {
                block: "",
                "custom-classes": "font-bold text-lg flex-1",
                type: "gray"
              }, {
                default: withCtx(() => [..._cache[6] || (_cache[6] = [
                  createTextVNode("Get Pro", -1)
                ])]),
                _: 1
              })
            ])
          ], 64))
        ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
          _cache[9] || (_cache[9] = createBaseVNode("span", { class: "text-lg border-stroke bg-gray-900/50 px-4 py-2 rounded-xl flex-1 flex items-center justify-center opacity-50" }, "Login To ClickPilot", -1)),
          createVNode(BaseButton, {
            onClick: _cache[4] || (_cache[4] = ($event) => emit("login")),
            type: "gray",
            block: "",
            "custom-classes": "font-bold text-lg flex-1 "
          }, {
            default: withCtx(() => [..._cache[8] || (_cache[8] = [
              createTextVNode("Login", -1)
            ])]),
            _: 1
          })
        ], 64))
      ]);
    };
  }
});
const _hoisted_1 = {
  key: 0,
  class: "main fixed bottom-0 left-0 text-3xl w-full p-4 text-center pointer-events-none"
};
const _hoisted_2 = { class: "flex-1 min-w-0 relative" };
const _hoisted_3 = { class: "text-center overflow-hidden px-4 py-2 flex-1 cursor-grab" };
const _hoisted_4 = { class: "flex gap-2" };
const _hoisted_5 = { class: "p-2 flex justify-center items-center flex-col gap-2" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "app",
  setup(__props) {
    const videos$1 = computed(() => {
      return videos.value;
    });
    const user$1 = computed(() => {
      return user.value;
    });
    const projects = computed(() => {
      var _a, _b;
      const personalProjects = ((_a = user.value) == null ? void 0 : _a.projects) ?? [];
      const editorProjects = ((_b = user.value) == null ? void 0 : _b.editorBaseProjects) ?? [];
      return [...personalProjects, ...editorProjects];
    });
    const selectedProjectName = computed(() => {
      if (!selectedProjectID.value) return null;
      if (!user$1.value) return null;
      const project = projects.value.find(
        (project2) => project2._id === selectedProjectID.value
      );
      if (!project) return null;
      return project.name;
    });
    async function selectProject(project) {
      await SetSelectedProjectID(project._id);
    }
    function login() {
      SendMessageToSW("login");
    }
    async function saveVideos() {
      try {
        await SaveVideos();
        CreateToast({
          message: `Successfully saved videos`,
          type: "success"
        });
      } catch (error) {
        console.error(error);
        CreateToast({
          message: error.message,
          type: "error"
        });
      }
    }
    function scrollThumbIntoView(id) {
      if (!id) return;
      const newTarget = document.getElementById(`${id}`);
      if (!newTarget) return;
      newTarget.scrollIntoView({
        behavior: "smooth",
        inline: "center"
      });
    }
    return (_ctx, _cache) => {
      const _directive_dragscroll = resolveDirective("dragscroll");
      return openBlock(), createBlock(ToastProvider, null, {
        default: withCtx(() => [
          videos$1.value.length ? (openBlock(), createElementBlock("div", _hoisted_1, [
            createVNode(_sfc_main$7, { "custom-classes": "relative inline-flex shadow-xl shadow-black p-0  max-w-full pointer-events-auto" }, {
              default: withCtx(() => [
                createVNode(_sfc_main$1, {
                  selectedProjectName: selectedProjectName.value,
                  selectedProjectID: unref(selectedProjectID),
                  projects: projects.value,
                  user: user$1.value,
                  onLogin: login,
                  onSaveVideos: saveVideos,
                  onSelectProject: selectProject
                }, null, 8, ["selectedProjectName", "selectedProjectID", "projects", "user"]),
                createBaseVNode("div", _hoisted_2, [
                  _cache[0] || (_cache[0] = createBaseVNode("div", { class: "z-10 absolute top-0 bottom-0 left-0 w-6 bg-gradient-to-r from-gray-800 to-transparent pointer-events-none rounded-tl-2xl rounded-bl-2xl" }, null, -1)),
                  withDirectives((openBlock(), createElementBlock("div", _hoisted_3, [
                    createBaseVNode("div", _hoisted_4, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(videos$1.value, (video) => {
                        return openBlock(), createBlock(Thumbnail, {
                          key: video.id,
                          id: video.id,
                          videoID: video.id,
                          onOnMount: ($event) => scrollThumbIntoView(video.id),
                          onDelete: ($event) => unref(RemoveVideo)(video.id)
                        }, null, 8, ["id", "videoID", "onOnMount", "onDelete"]);
                      }), 128))
                    ])
                  ])), [
                    [_directive_dragscroll]
                  ]),
                  _cache[1] || (_cache[1] = createBaseVNode("div", { class: "z-10 absolute top-0 right-0 h-full w-4 bg-gradient-to-l from-gray-800 to-transparent pointer-events-none" }, null, -1))
                ]),
                createBaseVNode("div", _hoisted_5, [
                  createVNode(BaseButton, {
                    onClick: unref(RemoveAllVideos),
                    "custom-classes": "text-xl p-0 w-12 h-12",
                    type: "gray"
                  }, {
                    default: withCtx(() => [..._cache[2] || (_cache[2] = [
                      createBaseVNode("svg", {
                        xmlns: "http://www.w3.org/2000/svg",
                        height: "1em",
                        width: "1em",
                        viewBox: "0 0 448 512"
                      }, [
                        createBaseVNode("path", {
                          fill: "currentColor",
                          d: "M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"
                        })
                      ], -1)
                    ])]),
                    _: 1
                  }, 8, ["onClick"])
                ])
              ]),
              _: 1
            })
          ])) : createCommentVNode("", true)
        ]),
        _: 1
      });
    };
  }
});
const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-02e285f7"]]);
const HOME_SELECTOR = "ytd-rich-item-renderer";
const LOCKUP_THUMBNAIL_LINK = "a.ytLockupViewModelContentImage, a.yt-lockup-view-model__content-image";
const LOCKUP_DURATION_BADGE = "yt-thumbnail-bottom-overlay-view-model .ytBadgeShapeText, yt-thumbnail-bottom-overlay-view-model .yt-badge-shape__text, yt-thumbnail-overlay-badge-view-model";
const LOCKUP_METADATA_ROW = ".ytContentMetadataViewModelMetadataRow, .yt-content-metadata-view-model__metadata-row";
const LOCKUP_METADATA_TEXT = ".ytContentMetadataViewModelMetadataText, .yt-content-metadata-view-model__metadata-text";
const CHANNEL_VERIFIED_BADGE = "a .ytAttributedStringImageElement, a .yt-core-attributed-string--link-inherit-color";
function HomeGetBtnContainer(parent) {
  const thumbnailElem = parent.querySelector(LOCKUP_THUMBNAIL_LINK);
  if (!thumbnailElem) return null;
  if (thumbnailElem.href.includes("/shorts/")) return null;
  const durationElem = thumbnailElem.querySelector(
    LOCKUP_DURATION_BADGE
  );
  if (!durationElem) return null;
  const metadataCont = parent.querySelector(
    "yt-content-metadata-view-model"
  );
  if (!metadataCont) return null;
  const metadataRows = metadataCont.querySelectorAll(LOCKUP_METADATA_ROW);
  if (!metadataRows.length) return null;
  const statsRow = metadataRows[1] ?? metadataRows[0];
  if (!statsRow) return null;
  return statsRow;
}
function HomeExtractor(parent) {
  var _a, _b, _c, _d;
  const thumbnailElem = parent.querySelector(LOCKUP_THUMBNAIL_LINK);
  const id = new URL(thumbnailElem.href).searchParams.get("v");
  const duration = ((_b = (_a = thumbnailElem.querySelector(LOCKUP_DURATION_BADGE)) == null ? void 0 : _a.innerText) == null ? void 0 : _b.trim()) ?? "";
  const detailsElem = parent.querySelector(
    "yt-lockup-metadata-view-model"
  );
  const channelAvatar = detailsElem.querySelector(
    "yt-avatar-shape img"
  ).src;
  const title = detailsElem.querySelector(
    "a.ytLockupMetadataViewModelTitle, h3"
  ).innerText;
  const metadataCont = detailsElem.querySelector(
    "yt-content-metadata-view-model"
  );
  const metadataRows = metadataCont.querySelectorAll(LOCKUP_METADATA_ROW);
  const bylineCont = metadataRows[0];
  const viewsAndUploadedLine = metadataRows[1] ?? metadataRows[0];
  const metadataTexts = viewsAndUploadedLine.querySelectorAll(LOCKUP_METADATA_TEXT);
  const views = (((_c = metadataTexts[0]) == null ? void 0 : _c.innerText) ?? "").split(" ")[0];
  const uploaded = ((_d = metadataTexts[1]) == null ? void 0 : _d.innerText) ?? "";
  const channelLink = bylineCont.querySelector("a");
  const channelName = channelLink.innerText.trim();
  const channelVerified = !!bylineCont.querySelector(CHANNEL_VERIFIED_BADGE);
  const channelHandleRaw = channelLink.href.split("@")[1];
  const channelHandle = channelHandleRaw ? `@${channelHandleRaw}` : null;
  return {
    id,
    title,
    views,
    uploaded,
    duration,
    channel: {
      avatar: channelAvatar,
      name: channelName,
      handle: channelHandle,
      verified: channelVerified
    }
  };
}
const CHANNEL_HOME_SELECTOR = "yt-lockup-view-model.yt-horizontal-list-renderer, ytd-grid-video-renderer #dismissible";
function getChannelHeaderData$1() {
  const channelHandle = new URL(window.location.href).pathname.split("/").slice(1)[0];
  const headerElem = document.querySelector(
    "yt-page-header-view-model"
  );
  const headerH1 = headerElem.querySelector("h1");
  return {
    avatar: headerElem.querySelector("yt-avatar-shape img").src,
    name: headerH1.innerText.trim(),
    handle: channelHandle,
    verified: !!headerH1.querySelector("yt-icon")
  };
}
function ChannelHomeGetBtnContainer(parent) {
  const thumbnailElem = parent.querySelector(
    LOCKUP_THUMBNAIL_LINK
  );
  if (thumbnailElem) {
    if (thumbnailElem.href.includes("/shorts/")) return null;
    const durationElem = thumbnailElem.querySelector(
      LOCKUP_DURATION_BADGE
    );
    if (!durationElem) return null;
    const metadataCont = parent.querySelector(
      "yt-content-metadata-view-model"
    );
    if (!metadataCont) return null;
    return metadataCont.querySelector(LOCKUP_METADATA_ROW);
  }
  return parent.querySelector("#metadata-line");
}
function extractLockupVideo$1(parent) {
  var _a, _b, _c, _d, _e;
  const thumbnailElem = parent.querySelector(
    LOCKUP_THUMBNAIL_LINK
  );
  if (!thumbnailElem) return null;
  const id = new URL(thumbnailElem.href).searchParams.get("v");
  if (!id) return null;
  const duration = ((_b = (_a = thumbnailElem.querySelector(LOCKUP_DURATION_BADGE)) == null ? void 0 : _a.innerText) == null ? void 0 : _b.trim()) ?? "";
  const detailsElem = parent.querySelector(
    "yt-lockup-metadata-view-model"
  );
  if (!detailsElem) return null;
  const title = (_c = detailsElem.querySelector(
    "a.ytLockupMetadataViewModelTitle, h3"
  )) == null ? void 0 : _c.innerText;
  if (!title) return null;
  const metadataCont = detailsElem.querySelector(
    "yt-content-metadata-view-model"
  );
  if (!metadataCont) return null;
  const metadataTexts = metadataCont.querySelectorAll(LOCKUP_METADATA_TEXT);
  return {
    id,
    title,
    views: (((_d = metadataTexts[0]) == null ? void 0 : _d.innerText) ?? "").split(" ")[0],
    uploaded: ((_e = metadataTexts[1]) == null ? void 0 : _e.innerText) ?? "",
    duration,
    channel: getChannelHeaderData$1()
  };
}
function extractLegacyGridVideo$1(parent) {
  const thumbnailElem = parent.querySelector("a#thumbnail");
  const id = new URL(thumbnailElem.href).searchParams.get("v");
  const duration = thumbnailElem.querySelector("#time-status").innerText.trim();
  const detailsMetaElem = parent.querySelector("#details #meta");
  const title = detailsMetaElem.querySelector("#video-title").innerText;
  const metadataLine = detailsMetaElem.querySelector("#metadata-line");
  const views = metadataLine.querySelector("span").innerText.split(" ")[0];
  const uploaded = metadataLine.querySelector("span + span").innerText;
  return {
    id,
    title,
    views,
    uploaded,
    duration,
    channel: getChannelHeaderData$1()
  };
}
function ChannelHomeExtractor(parent) {
  return extractLockupVideo$1(parent) ?? extractLegacyGridVideo$1(parent);
}
const CHANNEL_VIDEOS_SELECTOR = "ytd-rich-item-renderer, ytd-rich-grid-media #dismissible";
function getChannelHeaderData() {
  const channelHandle = new URL(window.location.href).pathname.split("/").slice(1)[0];
  const headerElem = document.querySelector(
    "yt-page-header-view-model"
  );
  const headerH1 = headerElem.querySelector("h1");
  return {
    avatar: headerElem.querySelector("yt-avatar-shape img").src,
    name: headerH1.innerText.trim(),
    handle: channelHandle,
    verified: !!headerH1.querySelector("yt-icon")
  };
}
function ChannelVideosGetBtnContainer(parent) {
  const thumbnailElem = parent.querySelector(LOCKUP_THUMBNAIL_LINK);
  if (thumbnailElem) {
    if (thumbnailElem.href.includes("/shorts/")) return null;
    const durationElem = thumbnailElem.querySelector(
      LOCKUP_DURATION_BADGE
    );
    if (!durationElem) return null;
    const metadataCont = parent.querySelector(
      "yt-content-metadata-view-model"
    );
    if (!metadataCont) return null;
    return metadataCont.querySelector(LOCKUP_METADATA_ROW);
  }
  return parent.querySelector("#metadata-line");
}
function extractLockupVideo(parent) {
  var _a, _b, _c, _d, _e;
  const thumbnailElem = parent.querySelector(LOCKUP_THUMBNAIL_LINK);
  if (!thumbnailElem) return null;
  const id = new URL(thumbnailElem.href).searchParams.get("v");
  if (!id) return null;
  const duration = ((_b = (_a = thumbnailElem.querySelector(LOCKUP_DURATION_BADGE)) == null ? void 0 : _a.innerText) == null ? void 0 : _b.trim()) ?? "";
  const detailsElem = parent.querySelector(
    "yt-lockup-metadata-view-model"
  );
  if (!detailsElem) return null;
  const title = (_c = detailsElem.querySelector(
    "a.ytLockupMetadataViewModelTitle, h3"
  )) == null ? void 0 : _c.innerText;
  if (!title) return null;
  const metadataCont = detailsElem.querySelector(
    "yt-content-metadata-view-model"
  );
  if (!metadataCont) return null;
  const metadataTexts = metadataCont.querySelectorAll(LOCKUP_METADATA_TEXT);
  return {
    id,
    title,
    views: (((_d = metadataTexts[0]) == null ? void 0 : _d.innerText) ?? "").split(" ")[0],
    uploaded: ((_e = metadataTexts[1]) == null ? void 0 : _e.innerText) ?? "",
    duration,
    channel: getChannelHeaderData()
  };
}
function extractLegacyGridVideo(parent) {
  const thumbnailElem = parent.querySelector("a#thumbnail");
  const id = new URL(thumbnailElem.href).searchParams.get("v");
  const duration = thumbnailElem.querySelector("#time-status").innerText.trim();
  const detailsMetaElem = parent.querySelector("#details #meta");
  const title = detailsMetaElem.querySelector("#video-title").innerText;
  const metadataLine = detailsMetaElem.querySelector("#metadata-line");
  const views = metadataLine.querySelector("span").innerText.split(" ")[0];
  const uploaded = metadataLine.querySelector("span + span").innerText;
  return {
    id,
    title,
    views,
    uploaded,
    duration,
    channel: getChannelHeaderData()
  };
}
function ChannelVideosExtractor(parent) {
  return extractLockupVideo(parent) ?? extractLegacyGridVideo(parent);
}
const RESULTS_SELECTOR = "ytd-video-renderer #dismissible";
function ResultsGetBtnContainer(parent) {
  const thumbnailElem = parent.querySelector("a#thumbnail");
  if (!thumbnailElem) return null;
  if (thumbnailElem.href.includes("/shorts/")) return null;
  if (!thumbnailElem.querySelector("#time-status")) return null;
  return parent.querySelector("#metadata-line");
}
function ResultsExtractor(parent) {
  const thumbnailElem = parent.querySelector("a#thumbnail");
  const id = new URL(thumbnailElem.href).searchParams.get("v");
  if (!id) throw new Error("Could not extract video id");
  const duration = thumbnailElem.querySelector("#time-status").innerText.trim();
  const detailsMetaElem = parent.querySelector("#meta");
  const title = detailsMetaElem.querySelector("#video-title").innerText;
  const metadataLine = detailsMetaElem.querySelector("#metadata-line");
  const views = metadataLine.querySelector("span").innerText.split(" ")[0];
  const uploaded = metadataLine.querySelector("span + span").innerText;
  const channelInfoElem = parent.querySelector("#channel-info");
  const channelThumbnailElem = channelInfoElem.querySelector("#channel-thumbnail");
  const channelAvatar = channelThumbnailElem.querySelector("img").src;
  const channelHandleRaw = channelThumbnailElem.href.split("@")[1];
  const channelHandle = channelHandleRaw ? `@${channelHandleRaw}` : null;
  const channelName = channelInfoElem.innerText.trim();
  const channelVerified = !!channelInfoElem.querySelector(
    ".badge-style-type-verified"
  );
  return {
    id,
    title,
    views,
    uploaded,
    duration,
    channel: {
      avatar: channelAvatar,
      name: channelName,
      handle: channelHandle,
      verified: channelVerified
    }
  };
}
function WatchGetBtnContainer(parent) {
  return parent.querySelector("#owner");
}
function WatchExtractor(parent) {
  var _a, _b, _c, _d;
  const id = parent.getAttribute("video-id");
  if (!id) throw new Error("Could not extract video id");
  const title = parent.querySelector("#title h1").innerText;
  const duration = ((_a = parent.querySelector(".ytp-time-duration")) == null ? void 0 : _a.innerText) || "";
  let views = "";
  let uploaded = "";
  const watchInfoTextElem = parent.querySelector(
    "#description ytd-watch-info-text"
  );
  if (watchInfoTextElem.getAttribute("disable-upgrade") === null) {
    const liveViews = (_b = watchInfoTextElem.querySelector("#view-count")) == null ? void 0 : _b.getAttribute("aria-label");
    if (liveViews) {
      views = liveViews.split(" ")[0];
      const uploadedDate = (_d = (_c = watchInfoTextElem.querySelector("#date-text")) == null ? void 0 : _c.getAttribute("aria-label")) == null ? void 0 : _d.trim();
      uploaded = uploadedDate || "";
    } else {
      const infoElem = watchInfoTextElem.querySelector("#info");
      views = infoElem.children[0].innerText.split(" ")[0];
      uploaded = infoElem.children[2].innerText;
    }
  } else {
    const infoElem = parent.querySelector("#description #info");
    views = infoElem.children[0].innerText.split(" ")[0];
    uploaded = infoElem.children[2].innerText;
  }
  const ownerRenderer = parent.querySelector("ytd-video-owner-renderer");
  const avatarLink = ownerRenderer.querySelector("a");
  const channelHandleRaw = avatarLink.href.split("@")[1];
  const channelHandle = channelHandleRaw ? `@${channelHandleRaw}` : null;
  const channelAvatar = avatarLink.querySelector("img").src;
  const channelName = ownerRenderer.querySelector("#channel-name").innerText;
  const channelVerified = !!ownerRenderer.querySelector(
    ".badge-style-type-verified"
  );
  return {
    id,
    title,
    views,
    uploaded,
    duration,
    channel: {
      avatar: channelAvatar,
      name: channelName,
      handle: channelHandle,
      verified: channelVerified
    }
  };
}
const extractorMap = {
  home: {
    btnContSelector: HOME_SELECTOR,
    extract: HomeExtractor,
    getBtnContainer: HomeGetBtnContainer,
    checkCanInjectBtns: checkForTimeStamps,
    btnExpands: true
  },
  results: {
    btnContSelector: RESULTS_SELECTOR,
    extract: ResultsExtractor,
    getBtnContainer: ResultsGetBtnContainer,
    checkCanInjectBtns: checkForTimeStamps,
    btnExpands: true
  },
  channelHome: {
    btnContSelector: CHANNEL_HOME_SELECTOR,
    extract: ChannelHomeExtractor,
    getBtnContainer: ChannelHomeGetBtnContainer,
    checkCanInjectBtns: checkForTimeStamps
  },
  channelVideos: {
    btnContSelector: CHANNEL_VIDEOS_SELECTOR,
    extract: ChannelVideosExtractor,
    getBtnContainer: ChannelVideosGetBtnContainer,
    checkCanInjectBtns: checkForTimeStamps
  },
  watch: {
    btnContSelector: "",
    //has to be set dynamically in main()
    extract: WatchExtractor,
    getBtnContainer: WatchGetBtnContainer,
    checkCanInjectBtns: () => true,
    btnExpands: true,
    classes: ["click-pilot-clipper-btn-large"]
  }
};
const btnInsertionCache = /* @__PURE__ */ new Map();
const TAB_CLICK_SELECTOR = "yt-touch-feedback-shape, chip-shape, .ytChipBarViewModelChipBarScrollContainer";
let activeExtractors = [];
let cleanUpFN;
let refreshTimeout = null;
function scheduleTabRefresh(delay = 300) {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => {
    refreshTimeout = null;
    btnInsertionCache.clear();
    refreshButtons();
  }, delay);
}
function refreshButtons() {
  activeExtractors.forEach((extractor) => {
    queryAndCreateBtns(extractor);
  });
}
async function InsertOnAllYoutubeVideos() {
  cleanUpFN = main();
  document.addEventListener(
    "click",
    (e) => {
      if (e.target instanceof HTMLElement && e.target.closest(TAB_CLICK_SELECTOR)) {
        scheduleTabRefresh();
      }
    },
    {
      capture: true,
      passive: true
    }
  );
  document.addEventListener("custom-yt-tab-change", () => {
    scheduleTabRefresh();
  });
  document.addEventListener(
    "yt-navigate-finish",
    () => {
      console.log("yt-navigate-finish");
      onPageChange();
    },
    {
      capture: true,
      passive: true
    }
  );
  window.addEventListener(
    "popstate",
    () => {
      console.log("popstate");
      onPageChange();
    },
    {
      capture: true,
      passive: true
    }
  );
}
function onPageChange() {
  console.log("on page change");
  if (cleanUpFN) {
    cleanUpFN();
  }
  cleanUpFN = main();
}
function main() {
  btnInsertionCache.clear();
  activeExtractors = [];
  const url = new URL(window.location.href);
  let page;
  const extractors = [];
  if (url.pathname === "/") {
    page = "home";
  } else {
    const paths = url.pathname.split("/").slice(1);
    if (paths[0].startsWith("@")) {
      if (paths[1] === "videos") {
        page = "channelVideos";
      } else if (!paths[1] || paths[1] === "featured") {
        page = "channelHome";
      }
    } else {
      page = paths[0];
    }
  }
  if (page === "watch") {
    if (document.querySelector("ytd-watch-flexy")) {
      page = "watchFlex";
      const watchExtractor = {
        ...extractorMap.watch,
        btnContSelector: "ytd-watch-flexy"
      };
      extractors.push(watchExtractor);
    } else {
      page = "watchGrid";
      const watchExtractor = {
        ...extractorMap.watch,
        btnContSelector: "ytd-watch-grid"
      };
      extractors.push(watchExtractor);
      extractors.push(extractorMap.home);
    }
  } else if (page in extractorMap) {
    extractors.push(extractorMap[page]);
  }
  if (!extractors.length) {
    return () => {
    };
  }
  activeExtractors = extractors;
  refreshButtons();
  console.log("creating query interval");
  const clearQueryInterval = createNewIntervalFN(() => {
    refreshButtons();
  }, 1e3);
  return () => {
    console.log("cleaning up");
    clearQueryInterval();
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    btnInsertionCache.forEach((btn) => {
      btn == null ? void 0 : btn.remove();
    });
    btnInsertionCache.clear();
    activeExtractors = [];
  };
}
function queryAndCreateBtns(extractor) {
  const buttonContElems = document.querySelectorAll(
    extractor.btnContSelector
  );
  if (!buttonContElems.length) {
    console.log("no button cont elems found");
    return;
  } else if (!extractor.checkCanInjectBtns()) {
    console.log("check can inject btns failed");
    return;
  }
  buttonContElems == null ? void 0 : buttonContElems.forEach((btnCont) => {
    createBtn(btnCont, extractor);
  });
}
function createBtn(parent, extractor) {
  const cachedBtn = btnInsertionCache.get(parent);
  if (cachedBtn && cachedBtn.isConnected && parent.isConnected && parent.contains(cachedBtn)) {
    return;
  }
  if (cachedBtn) {
    cachedBtn.remove();
    btnInsertionCache.delete(parent);
  }
  const btnCont = extractor.getBtnContainer(parent);
  if (!btnCont) {
    return;
  }
  const existingBtn = btnCont.querySelector(
    ".click-pilot-clipper-btn"
  );
  if (existingBtn) {
    btnInsertionCache.set(parent, existingBtn);
    return;
  }
  const clickPilotElem = document.createElement("div");
  clickPilotElem.classList.add("click-pilot-clipper-btn");
  if (extractor.classes) {
    clickPilotElem.classList.add(...extractor.classes);
  }
  const img = document.createElement("img");
  img.src = chrome.runtime.getURL("icon-128x128.png");
  img.alt = "click-pilot-clipper-btn";
  clickPilotElem.appendChild(img);
  clickPilotElem.onclick = async (e) => {
    try {
      e.stopImmediatePropagation();
      const data = extractor.extract(parent);
      await AddVideo(data);
    } catch (error) {
      console.log(error);
      CreateToast({
        message: "Couldn't add video",
        type: "error"
      });
    }
  };
  btnCont.appendChild(clickPilotElem);
  btnInsertionCache.set(parent, clickPilotElem);
}
function createNewIntervalFN(func, delay) {
  const interval = setInterval(func, delay);
  return () => {
    clearInterval(interval);
  };
}
function checkForTimeStamps() {
  return true;
}
const l = {
  addEventListeners(r, e, s) {
    for (let t = 0, a = e.length; t < a; t++)
      r.addEventListener(e[t], s, { passive: false });
  },
  removeEventListeners(r, e, s) {
    for (let t = 0, a = e.length; t < a; t++)
      r.removeEventListener(e[t], s, { passive: false });
  },
  emitEvent: function(r, e, s) {
    if (r.componentInstance)
      r.componentInstance.$emit(e, s);
    else {
      let t = new window.CustomEvent(e, { detail: s });
      r.el.dispatchEvent(t);
    }
  }
}, p = ["mousedown", "touchstart"], E = ["mousemove", "touchmove"], y = ["mouseup", "touchend"], T = function(r, e, s) {
  let t = r, a = true, m = window;
  typeof e.value == "boolean" ? a = e.value : typeof e.value == "object" ? (typeof e.value.target == "string" ? (t = r.querySelector(e.value.target), t || console.error("There is no element with the current target value.")) : typeof e.value.target < "u" && console.error(`The parameter "target" should be either 'undefined' or 'string'.`), typeof e.value.container == "string" ? (m = document.querySelector(e.value.container), m || console.error("There is no element with the current container value.")) : typeof e.value.container < "u" && console.error(`The parameter "container" should be be either 'undefined' or 'string'.`), typeof e.value.active == "boolean" ? a = e.value.active : typeof e.value.active < "u" && console.error(`The parameter "active" value should be either 'undefined', 'true' or 'false'.`)) : typeof e.value < "u" && console.error("The passed value should be either 'undefined', 'true' or 'false' or 'object'.");
  const g = function(u, d) {
    m === window ? window.scrollBy(u, d) : (m.scrollLeft += u, m.scrollTop += d);
  }, L = function() {
    let u, d, h, v = false;
    t.md = function(o) {
      const f = o instanceof window.MouseEvent, n = f ? o.pageX : o.touches[0].pageX, i = f ? o.pageY : o.touches[0].pageY, c = document.elementFromPoint(n - window.pageXOffset, i - window.pageYOffset), w = e.arg === "nochilddrag", Y = e.modifiers.noleft, S = e.modifiers.noright, D = e.modifiers.nomiddle, N = e.modifiers.noback, O = e.modifiers.noforward, V = e.arg === "firstchilddrag", C = c === t, M = c === t.firstChild, _ = w ? typeof (c == null ? void 0 : c.dataset.dragscroll) < "u" : typeof (c == null ? void 0 : c.dataset.noDragscroll) > "u";
      if (!(!C && (!_ || V && !M)) && !(o.button === 0 && Y)) {
        {
          if (o.button === 1 && D)
            return;
          if (o.button === 2 && S)
            return;
          if (o.button === 3 && N)
            return;
          if (o.button === 4 && O)
            return;
        }
        h = 1, u = f ? o.clientX : o.touches[0].clientX, d = f ? o.clientY : o.touches[0].clientY;
      }
    }, t.mu = function(o) {
      h = 0, v && l.emitEvent(s, "dragscrollend"), v = false;
    }, t.mm = function(o) {
      const f = o instanceof window.MouseEvent;
      let n, i;
      if (h) {
        o.preventDefault(), v || l.emitEvent(s, "dragscrollstart"), v = true;
        const c = t.scrollLeft + t.clientWidth >= t.scrollWidth || t.scrollLeft === 0, w = t.scrollTop + t.clientHeight >= t.scrollHeight || t.scrollTop === 0;
        n = -u + (u = f ? o.clientX : o.touches[0].clientX), i = -d + (d = f ? o.clientY : o.touches[0].clientY), e.modifiers.pass ? (t.scrollLeft -= e.modifiers.y ? -0 : n, t.scrollTop -= e.modifiers.x ? -0 : i, t === document.body && (t.scrollLeft -= e.modifiers.y ? -0 : n, t.scrollTop -= e.modifiers.x ? -0 : i), (c || e.modifiers.y) && g(-n, 0), (w || e.modifiers.x) && g(0, -i)) : (e.modifiers.x && (i = -0), e.modifiers.y && (n = -0), t.scrollLeft -= n, t.scrollTop -= i, t === document.body && (t.scrollLeft -= n, t.scrollTop -= i)), l.emitEvent(s, "dragscrollmove", {
          deltaX: -n,
          deltaY: -i
        });
      }
    }, l.addEventListeners(t, p, t.md), l.addEventListeners(window, y, t.mu), l.addEventListeners(window, E, t.mm);
  };
  a ? document.readyState === "complete" ? L() : window.addEventListener("load", L) : (l.removeEventListeners(t, p, t.md), l.removeEventListeners(window, y, t.mu), l.removeEventListeners(window, E, t.mm));
}, I = (r) => {
  const e = r;
  l.removeEventListeners(e, p, e.md), l.removeEventListeners(window, y, e.mu), l.removeEventListeners(window, E, e.mm);
}, X = {
  mounted: (r, e, s) => T(r, e, s),
  updated: (r, e, s) => {
    JSON.stringify(e.value) !== JSON.stringify(e.oldValue) && T(r, e, s);
  },
  unmounted: (r) => I(r)
}, R = {
  install(r) {
    r.directive("dragscroll", X);
  }
};
typeof window < "u" && window.Vue && (window.VueDragscroll = X);
try {
  (async () => {
    await Init();
    console.log("ClickPilot Clipper Init");
    InsertOnAllYoutubeVideos();
    console.log("ClickPilot Injection Success");
    const appElem = document.createElement("div");
    appElem.id = "click-pilot-clipper-app";
    document.body.appendChild(appElem);
    createApp(App).use(R).mount(appElem);
    console.log("ClickPilot App Mounted");
    window.addEventListener("focus", async () => {
      console.log("refreshing clickpilot data");
      await Init();
    });
  })();
} catch (error) {
  console.error(error);
}
