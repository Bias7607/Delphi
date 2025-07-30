import requests
from bs4 import BeautifulSoup

def parse_number(text):
    if text == '—':
        return None
    text = text.strip().replace(',', '').replace(' ', '').replace('−', '-')
    multiplier = 1
    if text[-1].upper() == 'K':
        multiplier = 1e3
        text = text[:-1]
    elif text[-1].upper() == 'M':
        multiplier = 1e6
        text = text[:-1]
    elif text[-1].upper() == 'B':
        multiplier = 1e9
        text = text[:-1]
    try:
        return float(text) * multiplier
    except ValueError:
        return None

def parse_percentage(text):
    if text == '—':
        return None
    text = text.strip().replace('%', '').replace('+', '').replace(',', '').replace(' ', '').replace('−', '-')
    try:
        return float(text)
    except ValueError:
        return None

def parse_price(text):
    if text == '—':
        return None
    text = text.strip().replace(',', '').replace(' ', '').replace('−', '-')
    try:
        return float(text)
    except ValueError:
        return None

def get_gainers(mode='normal'):
    urls = {
        'normal': "https://www.tradingview.com/markets/stocks-usa/market-movers-gainers/",
        'premarket': "https://www.tradingview.com/markets/stocks-usa/market-movers-pre-market-gainers/",
        'aftermarket': "https://www.tradingview.com/markets/stocks-usa/market-movers-after-hours-gainers/"
    }
    
    url = urls.get(mode)
    if not url:
        return []
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.google.com/",
        "Connection": "keep-alive"
    }
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    gainers = []
    
    tbody = soup.find('tbody')
    if tbody:
        rows = tbody.find_all('tr', class_='row-RdUXZpkv')
        for row in rows:
            data_rowkey = row.get('data-rowkey', '')
            if ':' in data_rowkey:
                ticker = data_rowkey.split(':')[-1]
            else:
                ticker = 'Unknown'
            
            sup = row.find('sup', class_='tickerDescription-GrtoTeat')
            name = sup.get('title', 'Unknown') if sup else 'Unknown'
            
            tds = row.find_all('td', class_='cell-RLhfr_y4')
            
            gainer = {
                'ticker': ticker,
                'name': name
            }
            
            if mode == 'normal':
                if len(tds) < 11:
                    continue
                gainer['change_percentage'] = parse_percentage(tds[1].text.strip())
                gainer['price'] = parse_price(tds[2].text.strip().replace(' USD', ''))
                gainer['volume'] = parse_number(tds[3].text.strip())
                gainer['rel_volume'] = parse_number(tds[4].text.strip())
                gainer['market_cap'] = parse_number(tds[5].text.strip().replace(' USD', ''))
                gainer['pe_ratio'] = parse_number(tds[6].text.strip())
                gainer['eps'] = parse_price(tds[7].text.strip().replace(' USD', ''))
                gainer['yearly_change'] = parse_percentage(tds[8].text.strip())
                gainer['dividend_yield'] = parse_percentage(tds[9].text.strip())
                sector_text = tds[10].text.strip()
                gainer['sector'] = sector_text if sector_text != '—' else None
                rating_text = tds[11].text.strip()
                gainer['rating'] = rating_text if rating_text != '—' else None
            
            elif mode == 'premarket':
                if len(tds) < 10:
                    continue
                gainer['change_percentage'] = parse_percentage(tds[1].text.strip())
                gainer['price'] = parse_price(tds[2].text.strip().replace(' USD', ''))
                gainer['change_amount'] = parse_price(tds[3].text.strip().replace(' USD', ''))
                gainer['volume'] = parse_number(tds[4].text.strip())
                gainer['gap_percent'] = parse_percentage(tds[5].text.strip())
                gainer['last_close'] = parse_price(tds[6].text.strip().replace(' USD', ''))
                gainer['regular_change_percent'] = parse_percentage(tds[7].text.strip())
                gainer['avg_volume'] = parse_number(tds[8].text.strip())
                gainer['market_cap'] = parse_number(tds[9].text.strip().replace(' USD', ''))
                if len(tds) > 10:
                    gainer['perf_ytd'] = parse_percentage(tds[10].text.strip())
            
            elif mode == 'aftermarket':
                if len(tds) < 9:
                    continue
                gainer['change_percentage'] = parse_percentage(tds[1].text.strip())
                gainer['price'] = parse_price(tds[2].text.strip().replace(' USD', ''))
                gainer['change_amount'] = parse_price(tds[3].text.strip().replace(' USD', ''))
                gainer['volume'] = parse_number(tds[4].text.strip())
                gainer['last_close'] = parse_price(tds[5].text.strip().replace(' USD', ''))
                gainer['perf_1d'] = parse_percentage(tds[6].text.strip())
                gainer['avg_volume'] = parse_number(tds[7].text.strip())
                gainer['market_cap'] = parse_number(tds[8].text.strip().replace(' USD', ''))
                if len(tds) > 9:
                    gainer['perf_ytd'] = parse_percentage(tds[9].text.strip())
            
            gainers.append(gainer)
    
    return gainers