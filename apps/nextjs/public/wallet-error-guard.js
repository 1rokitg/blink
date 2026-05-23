window.addEventListener(
  "error",
  function onWindowError(event) {
    if (
      event &&
      typeof event.message === "string" &&
      event.message.includes("Cannot redefine property: ethereum")
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  },
  true,
);
