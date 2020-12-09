"use strict";
const PEN_WIDTH = 4;
const ERASER_WIDTH = 50;
const usernameFormat = (username) => {
  return username.length > 0 ? `(${username})` : "";
};
styles.options = {
  closeButton: false,
  debug: false,
  newestOnTop: false,
  progressBar: true,
  positionClass: "toast-bottom-center",
  preventDuplicates: true,
  onclick: null,
  showDuration: "300",
  hideDuration: "1000",
  timeOut: "3000",
  extendedTimeOut: "1000",
  showEasing: "swing",
  hideEasing: "linear",
  showMethod: "fadeIn",
  hideMethod: "fadeOut",
};
const MODE = {
  pen: "pen",
  line: "line",
  box: "box",
  circle: "circle",
};

const ACTION = {
  drawLine: "drawLine",
};

(function () {
  const MENU_HEIGHT = 50;
  const PADDING = 40;
  const current = {
    id: "",
    x: 0,
    y: 0,
    color: "black",
    width: PEN_WIDTH,
    mode: MODE.pen,
  };
  let drawing = false;
  const History = [];
  let actionPointer = -1;
  function putAction(data) {
    if (History.length - 1 > actionPointer) {
      History.splice(actionPointer + 1);
    }
    History.push(data);
    actionPointer += 1;
  }
  function resetHistory() {
    History.splice(0);
    actionPointer = -1;
  }
  const canvas = document.getElementById("whiteboard");
  const context = canvas.getContext("2d");
  context.lineJoin = "round";
  context.lineCap = "round";
  const shapeLayer = document.getElementById("shape-layer");
  const shapeContext = shapeLayer.getContext("2d");
  shapeContext.lineJoin = "round";
  shapeContext.lineCap = "round";
  canvas.addEventListener("mousedown", onMouseDown, false);
  canvas.addEventListener("mouseup", onMouseUp, false);
  canvas.addEventListener("mouseout", onMouseUp, false);
  canvas.addEventListener("mousemove", curserControl(onMouseMove, 10), false);
  canvas.addEventListener("touchstart", onMouseDown, false);
  canvas.addEventListener("touchend", onMouseUp, false);
  canvas.addEventListener("touchcancel", onMouseUp, false);
  canvas.addEventListener("touchmove", curserControl(onMouseMove, 10), false);
  $(".color").click(onPenSelect);
  $(".line").click((e) => onSelect(e, MODE.line));
  $(".box").click((e) => onSelect(e, MODE.box));
  $(".circle").click((e) => onSelect(e, MODE.circle));
  $(".undo").click(onUndo);
  $(".redo").click(onRedo);
  $("#clear-button").click(onClearBoard);
  const path = window.location.pathname;
  const boardId = path.slice(path.lastIndexOf("/") + 1);
  const socket = io("?boardId=" + boardId);
  socket.on("drawLine", drawLine);
  socket.on("redraw", redraw);
  socket.on("clearBoard", () => {
    clearBoard();
    styles.info("Someone cleared the board.", "Infomation");
  });
  socket.emit("load", null, (data) => {
    console.log("load", data);
    const { status, lineHist, noteList } = data;
    if (status === "NOT_FOUND") {
      $.confirm({
        title: "NOT FOUND",
        content: "Sorry Return to the top page.",
        buttons: {
          ok: function () {
            window.location.href = "/";
          },
        },
      });
    }
    for (let line of lineHist) {
      drawLine(line, false);
    }
    for (let key of Object.keys(noteList)) {
    }
  });

  function redraw(data) {
    const { lineHist } = data;
    context.clearRect(
      0,
      0,
      context.canvas.clientWidth,
      context.canvas.clientHeight
    );
    for (const line of lineHist) {
      drawLine(line, false);
    }
  }

  function clearBoard() {
    context.clearRect(
      0,
      0,
      context.canvas.clientWidth,
      context.canvas.clientHeight
    );
    $(".clone-note").remove();
    resetHistory();
  }

  function onUndo() {
    if (actionPointer < 0) {
      styles.info("You can't undo anymore.", "Infomation");
      return;
    }
    const action = History[actionPointer];
    actionPointer -= 1;
    if (action.act === ACTION.drawLine) {
      socket.emit("hideLine", { id: action.id, hidden: true });
    }
  }

  function onRedo() {
    if (actionPointer === History.length - 1) {
      styles.info("You can't redo anymore.", "Infomation");
      return;
    }
    actionPointer += 1;
    const action = History[actionPointer];
    if (action.act === ACTION.drawLine) {
      socket.emit("hideLine", { id: action.id, hidden: false });
    }
  }

  function drawLine(data, drawing, emit) {
    if (data.hidden) return;

    const x0 = data.x0 - PADDING;
    const x1 = data.x1 - PADDING;
    const y0 = data.y0 - PADDING - MENU_HEIGHT;
    const y1 = data.y1 - PADDING - MENU_HEIGHT;
    if ([MODE.box, MODE.line, MODE.circle].includes(data.mode)) {
      const cxt = drawing ? shapeContext : context;
      shapeContext.clearRect(
        0,
        0,
        shapeContext.canvas.clientWidth,
        shapeContext.canvas.clientHeight
      );
      cxt.beginPath();
      if (data.mode === MODE.line) {
        cxt.moveTo(x0, y0);
        cxt.lineTo(x1, y1);
      } else if (data.mode === MODE.box) {
        cxt.rect(x0, y0, x1 - x0, y1 - y0);
      } else if (data.mode === MODE.circle) {
        const harfW = (x1 - x0) / 2;
        const harfH = (y1 - y0) / 2;
        cxt.arc(
          x0 + harfW,
          y0 + harfH,
          Math.max(Math.abs(harfW), Math.abs(harfH)),
          0,
          2 * Math.PI
        );
      }
      cxt.strokeStyle = data.color;
      cxt.lineWidth = data.width;
      cxt.stroke();
      cxt.closePath();
    } else {
      context.beginPath();
      context.moveTo(data.x0 - PADDING, data.y0 - PADDING - MENU_HEIGHT);
      context.lineTo(data.x1 - PADDING, data.y1 - PADDING - MENU_HEIGHT);
      context.strokeStyle = data.color;
      context.lineWidth = data.width;
      context.stroke();
      context.closePath();
    }

    if (emit) {
      socket.emit("drawLine", data);
    }
  }

  function saveCurrentPosition(e) {
    current.x = e.pageX || e.touches[0].pageX;
    current.y = e.pageY || e.touches[0].pageY;
  }

  function onMouseDown(e) {
    saveCurrentPosition(e);
    if ([MODE.pen, MODE.line, MODE.box, MODE.circle].includes(current.mode)) {
      drawing = true;
      current.id = randomUserID();
    }
    setCursor();
  }

  function onMouseUp(e) {
    if (drawing) {
      drawing = false;
      drawLine(
        {
          x0: current.x,
          y0: current.y,
          x1: e.pageX || e.touches[0].pageX,
          y1: e.pageY || e.touches[0].pageY,
          color: current.color,
          width: current.width,
          mode: current.mode,
          id: current.id,
        },
        false,
        true
      );
      putAction({ act: ACTION.drawLine, id: current.id });
    }

  }

  function onMouseMove(e) {
    const x0 = current.x;
    const y0 = current.y;
    const x1 = e.pageX || e.touches[0].pageX;
    const y1 = e.pageY || e.touches[0].pageY;
    if (drawing) {
      const isPenMode = current.mode === MODE.pen;
      drawLine(
        {
          x0,
          y0,
          x1,
          y1,
          color: current.color,
          width: current.width,
          mode: current.mode,
          id: current.id,
        },
        true,
        isPenMode
      );
      if (isPenMode) {
        saveCurrentPosition(e);
      }
    }
  }

  function onPenSelect(e) {
    const color = e.target.getAttribute("data-color");
    const eraser = color === "white";
    const width = eraser ? ERASER_WIDTH : PEN_WIDTH;
    current.color = color;
    current.width = width;
    current.mode = MODE.pen;
    const shapeColor = eraser ? "black" : color;
    $(".shape").css("color", shapeColor);
    setCursor();
  }

  function onSelect(e, mode) {
    const width = PEN_WIDTH;
    if (current.color === "white") {
      current.color = "black";
    }
    current.width = width;
    current.mode = mode;
    setCursor();
  }


  function onClearBoard() {
    $.confirm({
      theme: "supervan",
      icon: "fas fa-trash",
      title: "CLEAR",
      content: "Clear the board. Are you okay?",
      buttons: {
        ok: function () {
          socket.emit("clearBoard", null, () => {
            clearBoard();
          });
        },
        cancel: function () { },
      },
    });
  }
  function curserControl(callback, delay) {
    let previousCall = new Date().getTime();
    return function () {
      const time = new Date().getTime();
      if (time - previousCall >= delay) {
        previousCall = time;
        return callback.apply(null, arguments);
      }
    };
  }
  function setCursor() {
    const mode = current.mode;
    let color = current.color;
    let unicode, size, tweakX, tweakY, regular;
    if (mode === MODE.pen) {
      if (color === "white") {
        unicode = "\uf12d";
        size = 48;
        tweakX = 70;
        tweakY = 30;
        color = "black";
      } else {
        unicode = "\uf304";
        size = 24;
        tweakX = 25;
        tweakY = 25;
      }
    } else if (mode === MODE.line) {
      unicode = "\uf547";
      size = 24;
      tweakX = 35;
      tweakY = 15;
    } else if (mode === MODE.box) {
      unicode = "\uf0c8";
      size = 24;
      tweakX = 35;
      tweakY = 15;
      regular = true;
    } else if (mode === MODE.circle) {
      unicode = "\uf111";
      size = 24;
      tweakX = 35;
      tweakY = 15;
      regular = true;
    }

    const canvas = document.createElement("canvas");
    canvas.width = size * 2;
    canvas.height = size * 2;

    const context = canvas.getContext("2d");
    const regularFont = regular ? "" : "900";
    context.fillStyle = color;
    context.fillText(unicode, canvas.width / 2, canvas.width / 2);

    $("#whiteboard").css(
      "cursor",
      `url(${canvas.toDataURL("image/png")}) ${tweakX} ${tweakY}, auto`
    );
  }

  function randomUserID() {
    const strong = 12345;
    return (
      new Date().getTime().toString(16)
    );
  }
})();
