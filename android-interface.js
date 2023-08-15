var view, reader

document.addEventListener('DOMContentLoaded', async () => {
    view = document.createElement('foliate-view')
    reader = window.createReader()
    bookLoaded = false

    const onLoad = async ({ detail: { doc } }) => {
        if (bookLoaded) return

        const { book } = view
        const metadata = book.metadata

        const data = {
            title: metadata?.title,
            subtitle: metadata?.subtitle,
            author: metadata?.author,
            description: metadata?.description,
            identifier: metadata?.identifier,
            language: metadata?.language,
            publisher: metadata?.publisher,
            contributor: metadata?.contributor,
            published: metadata?.published,
            modified: metadata?.modified,
            subject: metadata?.subject,
            rights: metadata?.rights,
            toc: book.toc,
        }

        bookLoaded = true
        AndroidInterface.onBookLoaded(JSON.stringify(data))
    }

    lastLocation = { cfi:null, fraction: null }
    const onRelocate = ({ detail }) => {
        if (detail.cfi == lastLocation.cfi || detail.fraction == lastLocation.fraction) return
        lastLocation = Object.assign(detail)
        if(bookLoaded) AndroidInterface.onRelocated(JSON.stringify(detail))
    }

    view.addEventListener('load', onLoad)
    view.addEventListener('relocate', onRelocate)

    const params = new URLSearchParams(location.search)
    const url = params.get('url')

    try {
        const response = await fetch(url)
        const blob = await response.blob()
        const fileName = new URL(url).pathname
        reader.open(view, new File([blob], fileName))
    } catch (error) {
        console.error(error)
        AndroidInterface.onBookLoadFailed(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
})


const next = () => view.next()

const prev = () => view.prev()

const goto = (locator) => view.goTo(locator)

const gotoFraction = (fraction) => view.goToFraction(fraction)

const getTocFractions = () => {
    const tocFractions = []
    const sizes = view.book.sections.filter(s => s.linear !== 'no').map(s => s.size)
    if (sizes.length < 100) {
        const total = sizes.reduce((a, b) => a + b, 0)
        let sum = 0
        for (const size of sizes.slice(0, -1)) {
            sum += size
            const fraction = sum / total
            tocFractions.push(fraction)
        }
    }
    return tocFractions
}

const getAppearance = () => {
    const style = reader.style
    const layout = reader.layout

    const appearance = {};
    appearance.lineHeight = style.lineHeight
    appearance.justify = style.justify
    appearance.hypenate = style.hypenate
    appearance.themeName = style.theme.name
    appearance.lightFg = style.theme.light.fg
    appearance.lightBg = style.theme.light.bg
    appearance.lightLink = style.theme.light.link
    appearance.darkFg = style.theme.dark.fg
    appearance.darkBg = style.theme.dark.bg
    appearance.darkLink = style.theme.dark.link
    appearance.useDark = style.isDark

    appearance.gap = layout.gap
    appearance.maxInlineSize = layout.maxInlineSize
    appearance.maxBlockSize = layout.maxBlockSize
    appearance.maxColumnCount = layout.maxColumnCount
    appearance.flow = layout.flow

    return appearance
}

const setAppearance = (appearance) => {
    const style = { theme: { light: {}, dark: {} } }
    style.lineHeight = appearance.lineHeight
    style.justify = appearance.justify
    style.hypenate = appearance.hypenate
    style.theme.name = appearance.themeName
    style.theme.light.fg = appearance.lightFg
    style.theme.light.bg = appearance.lightBg
    style.theme.light.link = appearance.lightLink
    style.theme.dark.fg = appearance.darkFg
    style.theme.dark.bg = appearance.darkBg
    style.theme.dark.link = appearance.darkLink
    style.isDark = appearance.useDark

    const layout = {}
    layout.gap = appearance.gap
    layout.maxInlineSize = appearance.maxInlineSize
    layout.maxBlockSize = appearance.maxBlockSize
    layout.maxColumnCount = appearance.maxColumnCount
    layout.flow = appearance.flow

    reader.setAppearance(style, layout)
}
