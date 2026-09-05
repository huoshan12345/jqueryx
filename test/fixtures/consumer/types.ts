import 'jqueryx';

const buttons: JQuery<HTMLButtonElement> = $('button');
const sameButtons: JQuery<HTMLButtonElement> = jQuery('button');
const empty: boolean = buttons.isEmpty();
const title: string | undefined = sameButtons.title();
buttons.title('ready').onClick(element => element.focus());
buttons.onClick(() => buttons.addClass('clicked'), {
  onError: error => String(error),
});
buttons.onKeyDown((target, key) => target.setAttribute('data-key', key), {
  onError: async error => String(error),
});
buttons.onEnterDown(target => target.focus(), {
  onError: error => String(error),
});

// The global factory must retain jQuery's base types, not just jqueryx's augmentation.
// @ts-expect-error A button is not an input element.
const inputs: JQuery<HTMLInputElement> = buttons;

void [empty, title, inputs];
