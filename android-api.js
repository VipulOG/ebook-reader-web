function next() {
    globalThis.reader.view.goRight()
}

function prev() {
    globalThis.reader.view.goLeft()
}

function goto(locator) {
    globalThis.reader.view.goTo(locator)
}

function setTheme(theme) {
    globalThis.reader.setStyle(theme)
}

function getTheme() {
    return globalThis.reader.style
}

function setFlow(flow) {
    globalThis.reader.view.renderer.setAttribute('flow', flow)
}

function getFlow() {
    return globalThis.reader.view.renderer.getAttribute('flow')
}
