#!/usr/bin/env python3
"""
Game State Converter
Converts between Node.js poker game state and RLCard state format.
"""

# RLCard no-limit-holdem action mapping
# 0: fold, 1: check/call, 2: raise_half_pot, 3: raise_pot, 4: all_in
RLCARD_ACTIONS = {
    0: 'fold',
    1: 'check_call',
    2: 'raise_half_pot',
    3: 'raise_pot',
    4: 'all_in',
}

# Node.js card suit mapping
SUIT_MAP = {
    'hearts': 'H',
    'diamonds': 'D',
    'spades': 'S',
    'clubs': 'C',
    'h': 'H', 'd': 'D', 's': 'S', 'c': 'C',  # short form
    'H': 'H', 'D': 'D', 'S': 'S', 'C': 'C',  # already uppercase
}

RANK_MAP = {
    '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9',
    '10': 'T', 'T': 'T',
    'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
}


def convert_card(card):
    """Convert Node.js card format to RLCard format.

    Node.js: { rank: 'A', suit: 'hearts' }  or  'Ah'
    RLCard:  'AH'  (rank + suit uppercase)
    """
    if isinstance(card, str):
        # Already string format like 'Ah', 'Kd'
        if len(card) == 2:
            return RANK_MAP.get(card[0], card[0]) + SUIT_MAP.get(card[1], card[1])
        elif len(card) == 3:  # '10h'
            return 'T' + SUIT_MAP.get(card[2], card[2])
        return card.upper()
    elif isinstance(card, dict):
        rank = RANK_MAP.get(str(card.get('rank', '')), str(card.get('rank', '')))
        suit = SUIT_MAP.get(card.get('suit', ''), card.get('suit', ''))
        return rank + suit
    return str(card)


def convert_game_state(game_state):
    """Convert Node.js game state to a dict that decision_engine can process.

    Args:
        game_state: dict from Node.js with keys:
            hand: [{rank, suit}, ...] or ['Ah', 'Kd']
            board: [{rank, suit}, ...] or ['Qs', 'Jc', ...]
            pot: number
            callAmount: number
            minRaise: number
            stack: number
            position: string (button/sb/bb/utg/co)
            numPlayers: number

    Returns:
        Normalized dict for the decision engine.
    """
    hand = [convert_card(c) for c in game_state.get('hand', [])]
    board = [convert_card(c) for c in game_state.get('board', [])]

    return {
        'hand': hand,
        'board': board,
        'pot': game_state.get('pot', 0),
        'call_amount': game_state.get('callAmount', game_state.get('call_amount', 0)),
        'min_raise': game_state.get('minRaise', game_state.get('min_raise', 0)),
        'stack': game_state.get('stack', 0),
        'position': game_state.get('position', 'unknown'),
        'num_players': game_state.get('numPlayers', game_state.get('num_players', 2)),
    }


def convert_action_to_nodejs(action_id, game_state):
    """Convert RLCard action ID to Node.js action format.

    Args:
        action_id: int (0-4 for no-limit-holdem)
        game_state: normalized game state dict

    Returns:
        dict with 'action' and optional 'amount'
    """
    pot = game_state.get('pot', 0)
    call_amount = game_state.get('call_amount', 0)
    stack = game_state.get('stack', 0)
    min_raise = game_state.get('min_raise', 0)

    if action_id == 0:
        # fold — but if we can check for free, check instead
        if call_amount == 0:
            return {'action': 'check', 'amount': 0}
        return {'action': 'fold', 'amount': 0}

    elif action_id == 1:
        # check or call
        if call_amount == 0:
            return {'action': 'check', 'amount': 0}
        else:
            amount = min(call_amount, stack)
            return {'action': 'call', 'amount': amount}

    elif action_id == 2:
        # raise half pot
        raise_amount = max(pot // 2, min_raise)
        raise_amount = min(raise_amount, stack)
        if raise_amount <= call_amount:
            return {'action': 'call', 'amount': min(call_amount, stack)}
        return {'action': 'raise', 'amount': raise_amount}

    elif action_id == 3:
        # raise pot
        raise_amount = max(pot, min_raise)
        raise_amount = min(raise_amount, stack)
        if raise_amount <= call_amount:
            return {'action': 'call', 'amount': min(call_amount, stack)}
        return {'action': 'raise', 'amount': raise_amount}

    elif action_id == 4:
        # all in
        return {'action': 'raise', 'amount': stack}

    # fallback
    return {'action': 'check' if call_amount == 0 else 'fold', 'amount': 0}
