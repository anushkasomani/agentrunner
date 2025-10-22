insert into agents(id,name,capability,offer_url,rating) values
('fast-route','FastRoute','swap.spl','http://vendor1:7100/price',0.96)
on conflict (id) do nothing;

insert into agents(id,name,capability,offer_url,rating) values
('cheap-swap','CheapSwap','swap.spl','http://vendor2:7100/price',0.88)
on conflict (id) do nothing;

insert into agents(id,name,capability,offer_url,rating) values
('balanced-x','BalancedX','swap.spl','http://vendor3:7100/price',0.93)
on conflict (id) do nothing;
