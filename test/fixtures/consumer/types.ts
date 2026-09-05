import 'jqueryx';

const buttons: JQuery<HTMLButtonElement> = $('button');
const sameButtons: JQuery<HTMLButtonElement> = jQuery('button');
const empty: boolean = buttons.isEmpty();
const title: string | undefined = sameButtons.title();
buttons.title('ready').onClick(element => element.focus());

// The global factory must retain jQuery's base types, not just jqueryx's augmentation.
// @ts-expect-error A button is not an input element.
const inputs: JQuery<HTMLInputElement> = buttons;

void [empty, title, inputs];
