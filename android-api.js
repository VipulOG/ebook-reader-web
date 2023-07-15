function next() {
    globalThis.reader.view.next()
}

function prev() {
    globalThis.reader.view.prev()
}

function goto(locator) {
    globalThis.reader.view.goTo(locator)
}

function gotoFraction(fraction) {
    globalThis.reader.view.goToFraction(fraction)
}

function getTocFractions() {
    return globalThis.reader.getTocFractions()
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
