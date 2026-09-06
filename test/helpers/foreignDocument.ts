export function foreignDocument(): Document {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  return frame.contentDocument!;
}
