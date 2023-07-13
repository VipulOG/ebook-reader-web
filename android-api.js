function next() {
    globalThis.reader.view.goRight()
}

function prev() {
    globalThis.reader.view.goLeft()
}

function goto(locator) {
    globalThis.reader.view.goTo(locator)
}
