/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_printf.c                                      :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: max <max@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/24 00:00:00 by max               #+#    #+#             */
/*   Updated: 2026/05/24 00:00:00 by max              ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "ft_printf.h"

static int	ft_add(int total, int value)
{
	if (total < 0 || value < 0)
		return (-1);
	return (total + value);
}

int	ft_printf(const char *format, ...)
{
	va_list	ap;
	t_fmt	fmt;
	int		i;
	int		total;

	if (!format)
		return (-1);
	va_start(ap, format);
	i = 0;
	total = 0;
	while (format[i] && total >= 0)
	{
		if (format[i] == '%')
		{
			i = ft_parse(format, i + 1, &fmt);
			if (fmt.spec)
				total = ft_add(total, ft_format(ap, &fmt));
		}
		else
			total = ft_add(total, ft_putstrn(format + i++, 1));
	}
	va_end(ap);
	return (total);
}
