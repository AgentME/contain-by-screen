/* @flow */

import flatten from 'lodash/flatten';
import uniq from 'lodash/uniq';

type PositionOption = 'top'|'bottom'|'left'|'right'|'cover';
type HAlignOption = 'center'|'left'|'right';
type VAlignOption = 'center'|'top'|'bottom';

export type Position = PositionOption | PositionOption[];
export type HAlign = HAlignOption | HAlignOption[];
export type VAlign = VAlignOption | VAlignOption[];
export type Choice = {
  position: PositionOption;
  hAlign: HAlignOption;
  vAlign: VAlignOption;
};

export type Options = {
  position?: ?Position;
  forcePosition?: ?boolean;
  hAlign?: ?HAlign;
  forceHAlign?: ?boolean;
  vAlign?: ?VAlign;
  forceVAlign?: ?boolean;
  buffer?: ?number;
  topBuffer?: ?number;
  bottomBuffer?: ?number;
  leftBuffer?: ?number;
  rightBuffer?: ?number;
};

type Rect = { // Similar to ClientRect, but not a class
  top: number;
  bottom: number;
  height: number;
  left: number;
  right: number;
  width: number;
};

export default function containByScreen(element: HTMLElement, anchorPoint: HTMLElement, options: Options):
Choice {
  if (process.env.NODE_ENV !== 'production' && window.getComputedStyle) {
    const style = window.getComputedStyle(element);
    if (style.position !== 'fixed') {
      // eslint-disable-next-line no-console
      console.error('containByScreen only works on fixed position elements', element);
    }
  }

  const elRect: Rect = getBoundingClientRect(element);
  const anchorRect: Rect = getBoundingClientRect(anchorPoint);

  const buffers = {
    all: options.buffer || 0,
    top: options.topBuffer || 0,
    bottom: options.bottomBuffer || 0,
    left: options.leftBuffer || 0,
    right: options.rightBuffer || 0
  };

  const optionPositions = Array.isArray(options.position) ? options.position : [options.position].filter(Boolean);
  const optionHAligns = Array.isArray(options.hAlign) ? options.hAlign : [options.hAlign].filter(Boolean);
  const optionVAligns = Array.isArray(options.vAlign) ? options.vAlign : [options.vAlign].filter(Boolean);

  const positions: PositionOption[] = optionPositions.length > 0 && options.forcePosition ?
    optionPositions :
    uniq(optionPositions.concat(['top','bottom','left','right']));
  const hAligns: HAlignOption[] = optionHAligns.length > 0 && options.forceHAlign ?
    optionHAligns :
    uniq(optionHAligns.concat(['center','left','right']));
  const vAligns: VAlignOption[] = optionVAligns.length > 0 && options.forceVAlign ?
    optionVAligns :
    uniq(optionVAligns.concat(['center','top','bottom']));

  const allPossibleChoices = flatten(positions.map(position =>
    (position === 'cover') ?
      flatten(hAligns.map(hAlign => vAligns.map(vAlign => ({position, hAlign, vAlign})))) :
      (position === 'top' || position === 'bottom') ?
        hAligns.map(hAlign => ({position, hAlign, vAlign: 'center'})) :
        vAligns.map(vAlign => ({position, hAlign: 'center', vAlign}))
  ));

  let choiceAndCoord = null;
  for (let i=0; i < allPossibleChoices.length; i++) {
    const choice = allPossibleChoices[i];
    const coord = positionAndAlign(elRect, anchorRect, choice, buffers);
    const {top, left} = coord;
    if (
      top-buffers.all-buffers.top >= 0 &&
      left-buffers.all-buffers.left >= 0 &&
      top+elRect.height+buffers.all+buffers.bottom <= window.innerHeight &&
      left+elRect.width+buffers.all+buffers.right <= window.innerWidth
    ) {
      choiceAndCoord = {choice, coord};
      break;
    }
  }

  // Fallback if we failed to find a position that fit on the screen.
  if (!choiceAndCoord) {
    const choice = {
      position: optionPositions[0]||'top',
      hAlign: optionHAligns[0]||'center',
      vAlign: optionVAligns[0]||'center'
    };
    choiceAndCoord = {
      choice,
      coord: positionAndAlign(elRect, anchorRect, choice, buffers)
    };
  }

  element.style.top = `${choiceAndCoord.coord.top}px`;
  element.style.left = `${choiceAndCoord.coord.left}px`;

  return choiceAndCoord.choice;
}

function getBoundingClientRect(el: Element): Rect {
  let rect = el.getBoundingClientRect();
  if (!('width' in rect)) {
    // IE <9 support
    rect = Object.assign(({
      width: rect.right-rect.left,
      height: rect.bottom-rect.top
    }: Object), rect);
  }
  return rect;
}

function positionAndAlign(elRect: Rect, anchorRect: Rect, {position, hAlign, vAlign}: Choice, buffers): {top: number, left: number} {
  let top=0, left=0;
  if (position === 'cover') {
    switch (hAlign) {
    case 'center':
      left = Math.round((anchorRect.left + anchorRect.right - elRect.width)/2);
      break;
    case 'left':
      left = Math.floor(anchorRect.left);
      break;
    case 'right':
      left = Math.ceil(anchorRect.right - elRect.width);
      break;
    default: throw new Error('Should not happen');
    }
    switch (vAlign) {
    case 'center':
      top = Math.round((anchorRect.top + anchorRect.bottom - elRect.height)/2);
      break;
    case 'top':
      top = Math.floor(anchorRect.top);
      break;
    case 'bottom':
      top = Math.ceil(anchorRect.bottom - elRect.height);
      break;
    default: throw new Error('Should not happen');
    }
  } else if (position === 'top' || position === 'bottom') {
    switch (position) {
    case 'top':
      top = Math.floor(anchorRect.top - elRect.height - buffers.all - buffers.bottom);
      break;
    case 'bottom':
      top = Math.ceil(anchorRect.bottom + buffers.all + buffers.top);
      break;
    default: throw new Error('Should not happen');
    }
    switch (hAlign) {
    case 'center':
      left = Math.round((anchorRect.left + anchorRect.right - elRect.width)/2);
      break;
    case 'left':
      left = Math.round(anchorRect.left);
      break;
    case 'right':
      left = Math.round(anchorRect.right - elRect.width);
      break;
    default: throw new Error('Should not happen');
    }
  } else {
    switch (position) {
    case 'left':
      left = Math.floor(anchorRect.left - elRect.width - buffers.all - buffers.right);
      break;
    case 'right':
      left = Math.ceil(anchorRect.right + buffers.all + buffers.left);
      break;
    default: throw new Error('Should not happen');
    }
    switch (vAlign) {
    case 'center':
      top = Math.round((anchorRect.top + anchorRect.bottom - elRect.height)/2);
      break;
    case 'top':
      top = Math.round(anchorRect.top);
      break;
    case 'bottom':
      top = Math.round(anchorRect.bottom - elRect.height);
      break;
    default: throw new Error('Should not happen');
    }
  }
  return {top, left};
}
