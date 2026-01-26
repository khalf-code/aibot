export function appendOverseerEvent(store, event) {
    if (!store.events)
        store.events = [];
    store.events.push(event);
}
export function appendOverseerEvents(store, events) {
    if (!store.events)
        store.events = [];
    store.events.push(...events);
}
